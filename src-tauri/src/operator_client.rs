//! Operator WebSocket 客户端
//!
//! 以 operator 角色连接 Gateway，用于管理操作（读取配置、查询模型、查看状态等）。
//! 与 ws_client.rs（node 角色）并行共存，互不干扰。
//!
//! 设计要点：
//! - 采用 request-response 模式：发送 JSON-RPC 风格请求，异步等待应答
//! - 内部维护 pending 请求表，超时自动清理
//! - 前端通过 `op_call` 发起任意 Gateway RPC 调用

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::{Mutex, oneshot};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

// ─── 常量 ────────────────────────────────────────────────────────

const OP_REQUEST_TIMEOUT_MS: u64 = 30_000;
const CONNECT_CHALLENGE_TIMEOUT_MS: u64 = 10_000;
const GATEWAY_PROTOCOL_VERSION: u32 = 3;
const OPERATOR_CLIENT_ID: &str = "cli";
const OPERATOR_CLIENT_MODE: &str = "cli";
const OPERATOR_DEVICE_FAMILY: &str = "desktop";
const OPERATOR_ROLE: &str = "operator";
const OPERATOR_SCOPES: [&str; 5] = [
    "operator.read",
    "operator.write",
    "operator.admin",
    "operator.approvals",
    "operator.pairing",
];

// ─── 类型定义 ────────────────────────────────────────────────────

/// 连接握手帧（与 openclaw Gateway 协议一致）
#[derive(Debug, Serialize)]
struct ConnectFrame {
    r#type: &'static str,
    id: String,
    method: &'static str,
    params: ConnectParams,
}

#[derive(Debug, Serialize)]
struct ConnectParams {
    #[serde(rename = "minProtocol")]
    min_protocol: u32,
    #[serde(rename = "maxProtocol")]
    max_protocol: u32,
    client: ClientInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    caps: Option<Vec<&'static str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    commands: Option<Vec<&'static str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    permissions: Option<serde_json::Value>,
    role: &'static str,
    scopes: Vec<&'static str>,
    auth: AuthInfo,
    device: DeviceInfo,
}

#[derive(Debug, Serialize)]
struct ClientInfo {
    id: &'static str,
    version: &'static str,
    platform: String,
    mode: &'static str,
    #[serde(rename = "deviceFamily")]
    device_family: &'static str,
}

#[derive(Debug, Serialize)]
struct AuthInfo {
    token: String,
}

#[derive(Debug, Serialize)]
struct DeviceInfo {
    id: String,
    #[serde(rename = "publicKey")]
    public_key: String,
    signature: String,
    #[serde(rename = "signedAt")]
    signed_at: u64,
    nonce: String,
}

/// Gateway 返回的通用消息帧
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct GatewayMessage {
    r#type: String,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    ok: Option<bool>,
    #[serde(default)]
    payload: Option<serde_json::Value>,
    #[serde(default)]
    error: Option<serde_json::Value>,
}

/// RPC 调用请求帧
#[derive(Debug, Serialize)]
struct RpcRequest {
    r#type: &'static str,
    id: String,
    method: String,
    params: serde_json::Value,
}

/// 单个 pending 请求的应答通道
struct PendingRequest {
    tx: oneshot::Sender<RpcResponse>,
}

/// RPC 响应结构（返回给前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub ok: bool,
    pub payload: Option<serde_json::Value>,
    pub error: Option<serde_json::Value>,
}

// ─── Operator 连接状态 ───────────────────────────────────────────

type OpSink = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    Message,
>;
type OpRead = futures_util::stream::SplitStream<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >
>;

struct OperatorState {
    sink: Option<OpSink>,
    pending: HashMap<String, PendingRequest>,
    request_counter: u64,
    connected: bool,
}

impl OperatorState {
    fn new() -> Self {
        Self {
            sink: None,
            pending: HashMap::new(),
            request_counter: 0,
            connected: false,
        }
    }

    fn next_id(&mut self) -> String {
        self.request_counter += 1;
        format!("op-{}", self.request_counter)
    }
}

static OP_STATE: std::sync::OnceLock<Arc<Mutex<OperatorState>>> = std::sync::OnceLock::new();

fn get_op_state() -> &'static Arc<Mutex<OperatorState>> {
    OP_STATE.get_or_init(|| Arc::new(Mutex::new(OperatorState::new())))
}

// ─── Tauri Commands ──────────────────────────────────────────────

/// 建立 operator WebSocket 连接（复用 node 连接的同一 Gateway 地址和 token）
#[tauri::command]
pub async fn op_connect(
    app: tauri::AppHandle,
    gateway_url: String,
    token: String,
    agent_id: String,
    _device_name: String,
    public_key_raw: Option<String>,
    private_key_raw: Option<String>,
) -> Result<(), String> {
    // 先断开旧连接
    {
        let mut state = get_op_state().lock().await;
        if let Some(ref mut sink) = state.sink {
            sink.close().await.ok();
        }
        state.sink = None;
        state.connected = false;
        // 清理所有 pending 请求
        for (_, req) in state.pending.drain() {
            let _ = req.tx.send(RpcResponse {
                ok: false,
                payload: None,
                error: Some(serde_json::json!({"message": "connection reset"})),
            });
        }
    }

    let url = build_gateway_ws_url(&gateway_url, &token)?;
    let token_for_auth = token.clone();
    let agent_id_for_connect = agent_id.clone();

    let state = get_op_state().clone();

    tauri::async_runtime::spawn(async move {
        match connect_async(&url).await {
            Ok((ws_stream, _)) => {
                let (write, mut read) = ws_stream.split();
                {
                    let mut st = state.lock().await;
                    st.sink = Some(write);
                }

                let challenge_nonce = match read_connect_challenge(&mut read).await {
                    Ok(nonce) => nonce,
                    Err(err) => {
                        app.emit("op:error", err.clone()).ok();
                        reset_operator_state_after_failure(&state, "operator 握手准备失败").await;
                        return;
                    }
                };

                // 构造 device 签名
                let device_info = match build_device_info(
                    &agent_id_for_connect,
                    &token_for_auth,
                    &challenge_nonce,
                    &public_key_raw,
                    &private_key_raw,
                ) {
                    Ok(info) => info,
                    Err(err) => {
                        app.emit("op:error", err.clone()).ok();
                        reset_operator_state_after_failure(&state, "operator 设备签名失败").await;
                        return;
                    }
                };

                // 发送 operator 握手帧
                let connect_frame = ConnectFrame {
                    r#type: "req",
                    id: "op-connect-1".to_string(),
                    method: "connect",
                    params: ConnectParams {
                        min_protocol: GATEWAY_PROTOCOL_VERSION,
                        max_protocol: GATEWAY_PROTOCOL_VERSION,
                        client: ClientInfo {
                            id: OPERATOR_CLIENT_ID,
                            version: env!("CARGO_PKG_VERSION"),
                            platform: std::env::consts::OS.to_string(),
                            mode: OPERATOR_CLIENT_MODE,
                            device_family: OPERATOR_DEVICE_FAMILY,
                        },
                        caps: None,
                        commands: None,
                        permissions: None,
                        role: OPERATOR_ROLE,
                        scopes: OPERATOR_SCOPES.to_vec(),
                        auth: AuthInfo {
                            token: token_for_auth,
                        },
                        device: device_info,
                    },
                };

                let frame_json = serde_json::to_string(&connect_frame).unwrap();
                let send_error = {
                    let mut st = state.lock().await;
                    if let Some(ref mut w) = st.sink {
                        w.send(Message::Text(frame_json.into()))
                            .await
                            .err()
                            .map(|e| format!("operator 握手帧发送失败: {}", e))
                    } else {
                        Some("operator 连接已断开".to_string())
                    }
                };
                if let Some(err) = send_error {
                    app.emit("op:error", err).ok();
                    reset_operator_state_after_failure(&state, "operator 握手帧发送失败").await;
                    return;
                }

                // 消息循环
                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            handle_op_message(&app, &state, &text).await;
                        }
                        Ok(Message::Close(_)) => {
                            app.emit("op:disconnected", ()).ok();
                            break;
                        }
                        Err(e) => {
                            app.emit("op:error", e.to_string()).ok();
                            break;
                        }
                        _ => {}
                    }
                }

                // 断开清理
                {
                    let mut st = state.lock().await;
                    st.sink = None;
                    st.connected = false;
                    for (_, req) in st.pending.drain() {
                        let _ = req.tx.send(RpcResponse {
                            ok: false,
                            payload: None,
                            error: Some(serde_json::json!({"message": "operator connection closed"})),
                        });
                    }
                }
            }
            Err(e) => {
                app.emit("op:error", format!("operator 连接失败: {}", e)).ok();
            }
        }
    });

    Ok(())
}

/// 通过 operator 连接调用任意 Gateway RPC 方法
///
/// # 示例
/// ```js
/// const result = await invoke("op_call", {
///   method: "config.get",
///   params: {}
/// });
/// // result = { ok: true, payload: { ... }, error: null }
/// ```
#[tauri::command]
pub async fn op_call(
    method: String,
    params: serde_json::Value,
) -> Result<RpcResponse, String> {
    let state = get_op_state();
    let (req_id, rx) = {
        let mut st = state.lock().await;
        if !st.connected {
            return Err("operator 未连接".to_string());
        }

        let req_id = st.next_id();
        let (tx, rx) = oneshot::channel::<RpcResponse>();
        st.pending.insert(req_id.clone(), PendingRequest { tx });

        // 发送请求帧
        let req = RpcRequest {
            r#type: "req",
            id: req_id.clone(),
            method,
            params,
        };

        let frame = serde_json::to_string(&req).map_err(|e| e.to_string())?;
        if let Some(ref mut w) = st.sink {
            w.send(Message::Text(frame.into()))
                .await
                .map_err(|e| format!("发送请求失败: {}", e))?;
        } else {
            st.pending.remove(&req_id);
            return Err("operator 连接已断开".to_string());
        }

        (req_id, rx)
    };

    // 带超时等待响应
    let timeout = tokio::time::timeout(Duration::from_millis(OP_REQUEST_TIMEOUT_MS), rx);
    match timeout.await {
        Ok(Ok(response)) => Ok(response),
        Ok(Err(_)) => {
            // channel 被 drop（连接断开等）
            let mut st = state.lock().await;
            st.pending.remove(&req_id);
            Err("请求被取消（连接可能已断开）".to_string())
        }
        Err(_) => {
            // 超时
            let mut st = state.lock().await;
            st.pending.remove(&req_id);
            Err(format!("请求超时（{}ms）", OP_REQUEST_TIMEOUT_MS))
        }
    }
}

/// 断开 operator 连接
#[tauri::command]
pub async fn op_disconnect() -> Result<(), String> {
    let mut st = get_op_state().lock().await;
    if let Some(ref mut w) = st.sink {
        w.close().await.ok();
    }
    st.sink = None;
    st.connected = false;
    for (_, req) in st.pending.drain() {
        let _ = req.tx.send(RpcResponse {
            ok: false,
            payload: None,
            error: Some(serde_json::json!({"message": "operator disconnected"})),
        });
    }
    Ok(())
}

// ─── 内部函数 ────────────────────────────────────────────────────

fn build_device_info(
    agent_id: &str,
    token: &str,
    challenge_nonce: &str,
    public_key_raw: &Option<String>,
    private_key_raw: &Option<String>,
) -> Result<DeviceInfo, String> {
    use crate::device_identity::sign_payload;

    let public_key = public_key_raw
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "缺少 operator 设备公钥，无法完成握手".to_string())?;
    let private_key = private_key_raw
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "缺少 operator 设备私钥，无法完成握手".to_string())?;

    let scopes = OPERATOR_SCOPES.join(",");
    let signed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let payload = format!(
        "v3|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
        agent_id,
        OPERATOR_CLIENT_ID,
        OPERATOR_CLIENT_MODE,
        OPERATOR_ROLE,
        scopes,
        signed_at,
        token,
        challenge_nonce,
        std::env::consts::OS,
        OPERATOR_DEVICE_FAMILY
    );
    let signature = sign_payload(private_key, &payload)
        .map_err(|e| format!("operator 设备签名失败: {}", e))?;

    Ok(DeviceInfo {
        id: agent_id.to_string(),
        public_key: public_key.to_string(),
        signature,
        signed_at,
        nonce: challenge_nonce.to_string(),
    })
}

/// 处理 operator 连接收到的 Gateway 消息
async fn handle_op_message(
    app: &tauri::AppHandle,
    state: &Arc<Mutex<OperatorState>>,
    text: &str,
) {
    let msg: GatewayMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => return,
    };

    match msg.r#type.as_str() {
        "res" => {
            // 握手响应
            if msg.id.as_deref() == Some("op-connect-1") {
                if msg.ok == Some(true) {
                    let mut st = state.lock().await;
                    st.connected = true;
                    app.emit("op:connected", ()).ok();
                } else {
                    let err_msg = msg
                        .error
                        .and_then(|e| e.get("message").and_then(|m| m.as_str().map(String::from)))
                        .unwrap_or_else(|| "operator 握手失败".to_string());
                    app.emit("op:error", err_msg).ok();
                }
                return;
            }

            // RPC 响应 → 匹配 pending 请求
            if let Some(id) = &msg.id {
                let mut st = state.lock().await;
                if let Some(pending) = st.pending.remove(id) {
                    let _ = pending.tx.send(RpcResponse {
                        ok: msg.ok.unwrap_or(false),
                        payload: msg.payload,
                        error: msg.error,
                    });
                }
            }
        }

        "event" => {
            // 转发 Gateway 事件到前端
            app.emit("op:event", serde_json::json!({
                "raw": text
            })).ok();
        }

        _ => {}
    }
}

async fn reset_operator_state_after_failure(
    state: &Arc<Mutex<OperatorState>>,
    reason: &str,
) {
    let mut st = state.lock().await;
    st.sink = None;
    st.connected = false;
    for (_, req) in st.pending.drain() {
        let _ = req.tx.send(RpcResponse {
            ok: false,
            payload: None,
            error: Some(serde_json::json!({ "message": reason })),
        });
    }
}

fn build_gateway_ws_url(gateway_url: &str, token: &str) -> Result<String, String> {
    let mut url = Url::parse(gateway_url)
        .map_err(|e| format!("无效的 gateway 地址: {}", e))?;

    match url.scheme() {
        "ws" | "wss" => {}
        "http" => {
            url.set_scheme("ws")
                .map_err(|_| "无法将 gateway 地址转换为 ws".to_string())?;
        }
        "https" => {
            url.set_scheme("wss")
                .map_err(|_| "无法将 gateway 地址转换为 wss".to_string())?;
        }
        scheme => {
            return Err(format!("不支持的 gateway 协议: {}", scheme));
        }
    }

    if url.path().is_empty() {
        url.set_path("/");
    }

    let mut existing: Vec<(String, String)> = url
        .query_pairs()
        .into_owned()
        .filter(|(k, _)| k != "token")
        .collect();
    if !token.trim().is_empty() {
        existing.push(("token".to_string(), token.to_string()));
    }
    url.set_query(None);
    if !existing.is_empty() {
        let mut qp = url.query_pairs_mut();
        for (k, v) in existing {
            qp.append_pair(&k, &v);
        }
    }

    Ok(url.to_string())
}

async fn read_connect_challenge(read: &mut OpRead) -> Result<String, String> {
    let timeout = tokio::time::sleep(std::time::Duration::from_millis(
        CONNECT_CHALLENGE_TIMEOUT_MS,
    ));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            _ = &mut timeout => {
                return Err("operator 等待 connect.challenge 超时".to_string());
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Some(nonce) = parse_connect_challenge_nonce(&text) {
                            return Ok(nonce);
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        return Err("operator 连接在握手前关闭".to_string());
                    }
                    Some(Err(e)) => {
                        return Err(e.to_string());
                    }
                    Some(_) => {}
                    None => {
                        return Err("operator 连接在握手前中断".to_string());
                    }
                }
            }
        }
    }
}

fn parse_connect_challenge_nonce(text: &str) -> Option<String> {
    let msg: GatewayMessage = serde_json::from_str(text).ok()?;
    if msg.r#type != "event" || msg.event.as_deref() != Some("connect.challenge") {
        return None;
    }
    let nonce = msg
        .payload
        .as_ref()
        .and_then(|payload| payload.get("nonce"))
        .and_then(|v| v.as_str())?
        .trim()
        .to_string();
    if nonce.is_empty() {
        return None;
    }
    Some(nonce)
}
