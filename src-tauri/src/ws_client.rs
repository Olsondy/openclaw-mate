use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use tauri::Manager;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const SIDECAR_TIMEOUT_MS: u64 = 30_000;
const CHANNEL_AUTH_STATUS_REQUEST_ID: &str = "channel-auth-status-1";

// ─── OpenClaw Gateway 协议结构 ───────────────────────────────────

/// 客户端发送的 connect 握手帧
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
    #[serde(rename = "displayName")]
    display_name: String,
}

/// Gateway 返回的通用消息帧
#[derive(Debug, Deserialize)]
struct GatewayMessage {
    r#type: String,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    ok: Option<bool>,
    #[serde(default)]
    payload: Option<serde_json::Value>,
    #[serde(default)]
    error: Option<serde_json::Value>,
}

/// Gateway hello-ok 响应中的 auth 信息
#[derive(Debug, Deserialize)]
struct HelloOkAuth {
    #[serde(rename = "deviceToken")]
    device_token: Option<String>,
}

/// Gateway hello-ok 响应的 payload
#[derive(Debug, Deserialize)]
struct HelloOkPayload {
    auth: Option<HelloOkAuth>,
}

#[derive(Debug, Deserialize)]
struct ChannelAuthStatusPayload {
    required: bool,
}

// ─── 前端 emit 的任务结构 ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WsTask {
    pub task_id: String,
    pub r#type: String,
    pub payload: serde_json::Value,
    pub require_approval: bool,
    pub timeout_ms: u64,
}

/// node.invoke 请求（Gateway 要求节点执行命令）
#[derive(Debug, Deserialize)]
struct NodeInvokeParams {
    #[serde(default)]
    command: String,
    #[serde(default)]
    args: serde_json::Value,
}

/// 任务执行结果，emit 到前端
#[derive(Debug, Serialize, Clone)]
pub struct TaskResult {
    pub task_id: String,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
}

// ─── WebSocket 连接状态（全局共享） ──────────────────────────────

type WsSink = Arc<Mutex<Option<futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>
    >,
    Message
>>>>;

static WS_SINK: std::sync::OnceLock<WsSink> = std::sync::OnceLock::new();

fn get_ws_sink() -> &'static WsSink {
    WS_SINK.get_or_init(|| Arc::new(Mutex::new(None)))
}

// ─── Tauri 命令 ──────────────────────────────────────────────────

#[tauri::command]
pub async fn connect_gateway(
    app: tauri::AppHandle,
    gateway_url: String,
    token: String,
    agent_id: String,
    device_name: String,
    public_key_raw: Option<String>,
    private_key_raw: Option<String>,
) -> Result<(), String> {
    let url = format!("{}?token={}", gateway_url, token);

    let token_clone = token.clone();
    let agent_id_clone = agent_id.clone();
    let device_name_clone = device_name.clone();

    tauri::async_runtime::spawn(async move {
        match connect_async(&url).await {
            Ok((ws_stream, _)) => {
                let (write, mut read) = ws_stream.split();

                // 存储 write 半端供后续发送消息使用
                {
                    let mut sink = get_ws_sink().lock().await;
                    *sink = Some(write);
                }

                // 构造 device 签名（device 身份可选，无密钥则降级为无设备签名）
                let device_info = if let (Some(pub_key), Some(priv_key)) =
                    (&public_key_raw, &private_key_raw)
                {
                    use crate::device_identity::sign_payload;
                    let signed_at = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;
                    let nonce = format!("{:016x}", rand::random::<u64>());
                    // 签名 payload 格式与 openclaw buildDeviceAuthPayloadV3 一致
                    let payload = format!(
                        "{{\"deviceId\":\"{}\",\"clientId\":\"easy-openclaw\",\"clientMode\":\"backend\",\"role\":\"node\",\"scopes\":[\"node.execute\"],\"signedAtMs\":{},\"nonce\":\"{}\"}}",
                        agent_id_clone, signed_at, nonce
                    );
                    let signature = sign_payload(priv_key, &payload)
                        .unwrap_or_default();
                    DeviceInfo {
                        id: agent_id_clone.clone(),
                        public_key: pub_key.clone(),
                        signature,
                        signed_at,
                        nonce,
                        display_name: device_name_clone.clone(),
                    }
                } else {
                    // 降级：无签名（兼容旧版本，安全性较低）
                    DeviceInfo {
                        id: agent_id_clone.clone(),
                        public_key: String::new(),
                        signature: String::new(),
                        signed_at: 0,
                        nonce: String::new(),
                        display_name: device_name_clone.clone(),
                    }
                };

                // 发送 OpenClaw 标准 connect 握手帧
                let connect_frame = ConnectFrame {
                    r#type: "req",
                    id: "connect-1".to_string(),
                    method: "connect",
                    params: ConnectParams {
                        min_protocol: 1,
                        max_protocol: 1,
                        client: ClientInfo {
                            id: "easy-openclaw",
                            version: env!("CARGO_PKG_VERSION"),
                            platform: std::env::consts::OS.to_string(),
                        },
                        role: "node",
                        scopes: vec!["node.execute"],
                        auth: AuthInfo {
                            token: token_clone,
                        },
                        device: device_info,
                    },
                };

                let frame_json = serde_json::to_string(&connect_frame).unwrap();
                {
                    let mut sink = get_ws_sink().lock().await;
                    if let Some(ref mut w) = *sink {
                        if let Err(e) = w.send(Message::Text(frame_json.into())).await {
                            app.emit("ws:error", format!("握手帧发送失败: {}", e)).ok();
                            return;
                        }
                    }
                }

                // 处理消息循环
                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            handle_gateway_message(&app, &text).await;
                        }
                        Ok(Message::Close(_)) => {
                            app.emit("ws:disconnected", ()).ok();
                            break;
                        }
                        Err(e) => {
                            app.emit("ws:error", e.to_string()).ok();
                            break;
                        }
                        _ => {}
                    }
                }

                // 断开时清理 sink
                {
                    let mut sink = get_ws_sink().lock().await;
                    *sink = None;
                }
            }
            Err(e) => {
                app.emit("ws:error", e.to_string()).ok();
            }
        }
    });

    Ok(())
}

/// 处理 Gateway 发来的消息
async fn handle_gateway_message(app: &tauri::AppHandle, text: &str) {
    let msg: GatewayMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => return, // 非标准帧，忽略
    };

    match msg.r#type.as_str() {
        // Gateway 握手响应
        "res" => {
            if msg.id.as_deref() == Some("connect-1") {
                if msg.ok == Some(true) {
                    // 握手成功
                    app.emit("ws:connected", ()).ok();

                    // 提取 deviceToken（后续可持久化）
                    if let Some(payload) = &msg.payload {
                        if let Ok(hello) = serde_json::from_value::<HelloOkPayload>(payload.clone()) {
                            if let Some(auth) = hello.auth {
                                if let Some(dt) = auth.device_token {
                                    app.emit("ws:device_token", &dt).ok();
                                }
                            }
                        }
                    }
                    // 补状态查询：重连后主动拉取通道授权状态
                    request_channel_auth_status().await;
                } else {
                    // 握手失败（可能是 pairing required）
                    let err_msg = msg.error
                        .and_then(|e| e.get("message").and_then(|m| m.as_str().map(|s| s.to_string())))
                        .unwrap_or_else(|| "握手失败".to_string());
                    app.emit("ws:error", err_msg).ok();
                }
            } else if msg.id.as_deref() == Some(CHANNEL_AUTH_STATUS_REQUEST_ID) {
                if msg.ok == Some(true) {
                    let parsed = msg
                        .payload
                        .as_ref()
                        .and_then(|payload| serde_json::from_value::<ChannelAuthStatusPayload>(payload.clone()).ok());
                    let required = match parsed {
                        Some(status) => status.required,
                        None => {
                            app.emit("ws:error", "channel.auth.status payload invalid".to_string()).ok();
                            return;
                        }
                    };
                    let event_name = if required {
                        "channel.auth.required"
                    } else {
                        "channel.auth.resolved"
                    };
                    app.emit("ws:gateway_event", serde_json::json!({
                        "event": event_name,
                        "payload": serde_json::Value::Null
                    })).ok();
                } else {
                    app.emit("ws:error", "channel.auth.status request failed".to_string()).ok();
                }
            }
        }

        // Gateway 请求（node.invoke 等）
        "req" => {
            if let Some(method) = &msg.method {
                match method.as_str() {
                    "node.invoke" => {
                        if let Some(params) = &msg.payload {
                            let invoke_params: NodeInvokeParams = match serde_json::from_value(params.clone()) {
                                Ok(p) => p,
                                Err(_) => return,
                            };
                            let req_id = msg.id.clone().unwrap_or_default();

                            // emit 到前端
                            let task = WsTask {
                                task_id: req_id.clone(),
                                r#type: invoke_params.command.split('.').next().unwrap_or("system").to_string(),
                                payload: invoke_params.args.clone(),
                                require_approval: false, // 审批逻辑由前端根据规则判断
                                timeout_ms: SIDECAR_TIMEOUT_MS,
                            };
                            app.emit("ws:task", &task).ok();

                            // 执行命令
                            let result = execute_command(app, &invoke_params.command, &invoke_params.args).await;

                            // 发送结果回 Gateway
                            send_response(&req_id, &result).await;

                            // emit 执行结果到前端
                            app.emit("ws:task_result", &result).ok();
                        }
                    }
                    _ => {
                        // 未知方法，回复 error
                        if let Some(ref id) = msg.id {
                            let error_res = serde_json::json!({
                                "type": "res",
                                "id": id,
                                "ok": false,
                                "error": { "message": format!("Unsupported method: {}", method) }
                            });
                            let mut sink = get_ws_sink().lock().await;
                            if let Some(ref mut w) = *sink {
                                w.send(Message::Text(error_res.to_string().into())).await.ok();
                            }
                        }
                    }
                }
            }
        }

        // Gateway 推送事件
        "event" => {
            if let Some(event_name) = &msg.event {
                app.emit("ws:gateway_event", serde_json::json!({
                    "event": event_name,
                    "payload": msg.payload
                })).ok();
            }
        }

        _ => {}
    }
}

async fn request_channel_auth_status() {
    let req = serde_json::json!({
        "type": "req",
        "id": CHANNEL_AUTH_STATUS_REQUEST_ID,
        "method": "channel.auth.status",
        "params": {}
    });
    let mut sink = get_ws_sink().lock().await;
    if let Some(ref mut w) = *sink {
        w.send(Message::Text(req.to_string().into())).await.ok();
    }
}

/// 执行命令（system.run / canvas.snapshot 本地执行；browser.* / vision.* 路由到 sidecar）
async fn execute_command(app: &tauri::AppHandle, command: &str, args: &serde_json::Value) -> TaskResult {
    use crate::sidecar::{SidecarManager, SidecarTask};

    let start = std::time::Instant::now();
    let task_type = command.split('.').next().unwrap_or("system");

    // Route browser.* and vision.* to sidecar
    if matches!(task_type, "browser" | "vision") {
        let mgr_state = app.try_state::<Arc<SidecarManager>>();
        return match mgr_state {
            Some(mgr) => {
                let task = SidecarTask {
                    task_id: format!("{}_{}", command,
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis()),
                    task_type: task_type.to_string(),
                    payload: args.clone(),
                    timeout_ms: SIDECAR_TIMEOUT_MS,
                };
                match mgr.execute(task).await {
                    Ok(res) => TaskResult {
                        task_id: String::new(),
                        success: res.status == "success",
                        stdout: res.result.map(|v: serde_json::Value| v.to_string()).unwrap_or_default(),
                        stderr: res.error.unwrap_or_default(),
                        exit_code: None,
                        duration_ms: start.elapsed().as_millis() as u64,
                    },
                    Err(e) => TaskResult {
                        task_id: String::new(),
                        success: false,
                        stdout: String::new(),
                        stderr: format!("sidecar error: {}", e),
                        exit_code: None,
                        duration_ms: start.elapsed().as_millis() as u64,
                    },
                }
            }
            None => TaskResult {
                task_id: String::new(),
                success: false,
                stdout: String::new(),
                stderr: "sidecar not available".to_string(),
                exit_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
            },
        };
    }

    match command {
        "system.run" => {
            let cmd_str = args.get("command")
                .and_then(|c| c.as_str())
                .unwrap_or("");

            let cwd = args.get("cwd")
                .and_then(|c| c.as_str());

            if cmd_str.is_empty() {
                return TaskResult {
                    task_id: String::new(),
                    success: false,
                    stdout: String::new(),
                    stderr: "No command provided".to_string(),
                    exit_code: None,
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }

            // Windows 用 cmd /C, Unix 用 sh -c
            let output = if cfg!(target_os = "windows") {
                let mut cmd = tokio::process::Command::new("cmd");
                cmd.args(["/C", cmd_str]);
                if let Some(dir) = cwd {
                    cmd.current_dir(dir);
                }
                cmd.output().await
            } else {
                let mut cmd = tokio::process::Command::new("sh");
                cmd.args(["-c", cmd_str]);
                if let Some(dir) = cwd {
                    cmd.current_dir(dir);
                }
                cmd.output().await
            };

            match output {
                Ok(out) => TaskResult {
                    task_id: String::new(),
                    success: out.status.success(),
                    stdout: String::from_utf8_lossy(&out.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&out.stderr).to_string(),
                    exit_code: out.status.code(),
                    duration_ms: start.elapsed().as_millis() as u64,
                },
                Err(e) => TaskResult {
                    task_id: String::new(),
                    success: false,
                    stdout: String::new(),
                    stderr: format!("Process error: {}", e),
                    exit_code: None,
                    duration_ms: start.elapsed().as_millis() as u64,
                },
            }
        }

        "canvas.snapshot" => {
            // TODO: 截图能力后续实现
            TaskResult {
                task_id: String::new(),
                success: false,
                stdout: String::new(),
                stderr: "canvas.snapshot not yet implemented".to_string(),
                exit_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
            }
        }

        _ => TaskResult {
            task_id: String::new(),
            success: false,
            stdout: String::new(),
            stderr: format!("Unsupported command: {}", command),
            exit_code: None,
            duration_ms: start.elapsed().as_millis() as u64,
        },
    }
}

/// 发送结果回 Gateway
async fn send_response(req_id: &str, result: &TaskResult) {
    let response = serde_json::json!({
        "type": "res",
        "id": req_id,
        "ok": result.success,
        "payload": {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exitCode": result.exit_code,
            "durationMs": result.duration_ms
        }
    });

    let mut sink = get_ws_sink().lock().await;
    if let Some(ref mut w) = *sink {
        w.send(Message::Text(response.to_string().into())).await.ok();
    }
}

#[tauri::command]
pub async fn disconnect_gateway() -> Result<(), String> {
    let mut sink = get_ws_sink().lock().await;
    if let Some(ref mut w) = *sink {
        w.close().await.ok();
    }
    *sink = None;
    Ok(())
}
