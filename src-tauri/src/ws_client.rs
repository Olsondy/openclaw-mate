use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::Manager;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

const SIDECAR_TIMEOUT_MS: u64 = 30_000;
const CHANNEL_AUTH_STATUS_REQUEST_ID: &str = "channel-auth-status-1";
const CONNECT_CHALLENGE_TIMEOUT_MS: u64 = 10_000;
const CONNECT_RESPONSE_TIMEOUT_MS: u64 = 10_000;
const GATEWAY_PROTOCOL_VERSION: u32 = 3;
const NODE_CLIENT_ID: &str = "node-host";
const NODE_CLIENT_MODE: &str = "node";
const NODE_DEVICE_FAMILY: &str = "desktop";
const NODE_ROLE: &str = "node";
const NODE_SCOPES: [&str; 1] = ["node.execute"];

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

type WsSink = Arc<
    Mutex<
        Option<
            futures_util::stream::SplitSink<
                tokio_tungstenite::WebSocketStream<
                    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
                >,
                Message,
            >,
        >,
    >,
>;
type WsRead = futures_util::stream::SplitStream<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
>;

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
    _device_name: String,
    public_key_raw: Option<String>,
    private_key_raw: Option<String>,
) -> Result<(), String> {
    let url = build_gateway_ws_url(&gateway_url, &token)?;

    // 新连接前先清理旧连接，避免并发读写同一个全局 sink
    {
        let mut sink = get_ws_sink().lock().await;
        if let Some(ref mut w) = *sink {
            w.close().await.ok();
        }
        *sink = None;
    }

    let (ws_stream, _) = connect_async(&url)
        .await
        .map_err(format_connect_async_error)?;
    let (mut write, mut read) = ws_stream.split();

    let challenge_nonce = read_connect_challenge(&mut read).await?;

    // 构造 device 签名（Gateway 新协议要求）
    let device_info = build_device_info(
        &agent_id,
        &token,
        &challenge_nonce,
        &public_key_raw,
        &private_key_raw,
    )?;

    // 发送 OpenClaw 标准 connect 握手帧
    let connect_frame = ConnectFrame {
        r#type: "req",
        id: "connect-1".to_string(),
        method: "connect",
        params: ConnectParams {
            min_protocol: GATEWAY_PROTOCOL_VERSION,
            max_protocol: GATEWAY_PROTOCOL_VERSION,
            client: ClientInfo {
                id: NODE_CLIENT_ID,
                version: env!("CARGO_PKG_VERSION"),
                platform: std::env::consts::OS.to_string(),
                mode: NODE_CLIENT_MODE,
                device_family: NODE_DEVICE_FAMILY,
            },
            caps: None,
            commands: None,
            permissions: None,
            role: NODE_ROLE,
            scopes: NODE_SCOPES.to_vec(),
            auth: AuthInfo {
                token: token.clone(),
            },
            device: device_info,
        },
    };

    let frame_json =
        serde_json::to_string(&connect_frame).map_err(|e| format!("握手帧序列化失败: {}", e))?;
    write
        .send(Message::Text(frame_json.into()))
        .await
        .map_err(|e| format!("握手帧发送失败: {}", e))?;

    let device_token = wait_connect_response(&mut read).await?;

    // 到这里才算真正连通：先挂载 sink，再发连接成功事件
    {
        let mut sink = get_ws_sink().lock().await;
        *sink = Some(write);
    }
    app.emit("ws:connected", ()).ok();
    if let Some(dt) = device_token {
        app.emit("ws:device_token", &dt).ok();
    }
    request_channel_auth_status().await;

    let app_for_loop = app.clone();
    tauri::async_runtime::spawn(async move {
        // 处理消息循环
        loop {
            match read.next().await {
                Some(Ok(Message::Text(text))) => {
                    handle_gateway_message(&app_for_loop, &text).await;
                }
                Some(Ok(Message::Close(_))) => {
                    app_for_loop.emit("ws:disconnected", ()).ok();
                    break;
                }
                Some(Err(e)) => {
                    app_for_loop.emit("ws:error", e.to_string()).ok();
                    app_for_loop.emit("ws:disconnected", ()).ok();
                    break;
                }
                Some(_) => {}
                None => {
                    // 对端异常退出（例如手动停止 gateway）时，Stream 会结束为 None。
                    // 这里必须显式通知前端断开，避免状态卡在 online。
                    app_for_loop.emit("ws:disconnected", ()).ok();
                    break;
                }
            }
        }

        // 断开时清理 sink
        let mut sink = get_ws_sink().lock().await;
        *sink = None;
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
                        if let Ok(hello) = serde_json::from_value::<HelloOkPayload>(payload.clone())
                        {
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
                    let err_msg = format!("握手失败: {}", format_gateway_error(msg.error.as_ref()));
                    app.emit("ws:error", err_msg).ok();
                }
            } else if msg.id.as_deref() == Some(CHANNEL_AUTH_STATUS_REQUEST_ID) {
                if msg.ok == Some(true) {
                    let parsed = msg.payload.as_ref().and_then(|payload| {
                        serde_json::from_value::<ChannelAuthStatusPayload>(payload.clone()).ok()
                    });
                    let required = match parsed {
                        Some(status) => status.required,
                        None => {
                            app.emit(
                                "ws:error",
                                "channel.auth.status payload invalid".to_string(),
                            )
                            .ok();
                            return;
                        }
                    };
                    let event_name = if required {
                        "channel.auth.required"
                    } else {
                        "channel.auth.resolved"
                    };
                    app.emit(
                        "ws:gateway_event",
                        serde_json::json!({
                            "event": event_name,
                            "payload": serde_json::Value::Null
                        }),
                    )
                    .ok();
                } else {
                    app.emit("ws:error", "channel.auth.status request failed".to_string())
                        .ok();
                }
            }
        }

        // Gateway 请求（node.invoke 等）
        "req" => {
            if let Some(method) = &msg.method {
                match method.as_str() {
                    "node.invoke" => {
                        if let Some(params) = &msg.payload {
                            let invoke_params: NodeInvokeParams =
                                match serde_json::from_value(params.clone()) {
                                    Ok(p) => p,
                                    Err(_) => return,
                                };
                            let req_id = msg.id.clone().unwrap_or_default();

                            // emit 到前端
                            let task = WsTask {
                                task_id: req_id.clone(),
                                r#type: invoke_params
                                    .command
                                    .split('.')
                                    .next()
                                    .unwrap_or("system")
                                    .to_string(),
                                payload: invoke_params.args.clone(),
                                require_approval: false, // 审批逻辑由前端根据规则判断
                                timeout_ms: SIDECAR_TIMEOUT_MS,
                            };
                            app.emit("ws:task", &task).ok();

                            // 执行命令
                            let result =
                                execute_command(app, &invoke_params.command, &invoke_params.args)
                                    .await;

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
                                w.send(Message::Text(error_res.to_string().into()))
                                    .await
                                    .ok();
                            }
                        }
                    }
                }
            }
        }

        // Gateway 推送事件
        "event" => {
            if let Some(event_name) = &msg.event {
                app.emit(
                    "ws:gateway_event",
                    serde_json::json!({
                        "event": event_name,
                        "payload": msg.payload
                    }),
                )
                .ok();
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
async fn execute_command(
    app: &tauri::AppHandle,
    command: &str,
    args: &serde_json::Value,
) -> TaskResult {
    use crate::sidecar::{SidecarManager, SidecarTask};

    let start = std::time::Instant::now();
    let task_type = command.split('.').next().unwrap_or("system");

    // Route browser.* and vision.* to sidecar
    if matches!(task_type, "browser" | "vision") {
        let mgr_state = app.try_state::<Arc<SidecarManager>>();
        return match mgr_state {
            Some(mgr) => {
                let task = SidecarTask {
                    task_id: format!(
                        "{}_{}",
                        command,
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis()
                    ),
                    task_type: task_type.to_string(),
                    payload: args.clone(),
                    timeout_ms: SIDECAR_TIMEOUT_MS,
                };
                match mgr.execute(task).await {
                    Ok(res) => TaskResult {
                        task_id: String::new(),
                        success: res.status == "success",
                        stdout: res
                            .result
                            .map(|v: serde_json::Value| v.to_string())
                            .unwrap_or_default(),
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
            let cmd_str = args.get("command").and_then(|c| c.as_str()).unwrap_or("");

            let cwd = args.get("cwd").and_then(|c| c.as_str());

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
        w.send(Message::Text(response.to_string().into()))
            .await
            .ok();
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

fn build_gateway_ws_url(gateway_url: &str, token: &str) -> Result<String, String> {
    let mut url = Url::parse(gateway_url).map_err(|e| format!("无效的 gateway 地址: {}", e))?;

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

    // 一些服务端会拒绝空 path 的 upgrade（`?token=`），强制规范化为 `/?token=...`
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

async fn read_connect_challenge(read: &mut WsRead) -> Result<String, String> {
    let timeout = tokio::time::sleep(std::time::Duration::from_millis(
        CONNECT_CHALLENGE_TIMEOUT_MS,
    ));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            _ = &mut timeout => {
                return Err("等待 connect.challenge 超时".to_string());
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Some(nonce) = parse_connect_challenge_nonce(&text) {
                            return Ok(nonce);
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        return Err("连接在握手前被关闭".to_string());
                    }
                    Some(Err(e)) => {
                        return Err(e.to_string());
                    }
                    Some(_) => {}
                    None => {
                        return Err("连接在握手前中断".to_string());
                    }
                }
            }
        }
    }
}

async fn wait_connect_response(read: &mut WsRead) -> Result<Option<String>, String> {
    let timeout = tokio::time::sleep(std::time::Duration::from_millis(
        CONNECT_RESPONSE_TIMEOUT_MS,
    ));
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            _ = &mut timeout => {
                return Err("等待 connect 响应超时".to_string());
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let parsed: GatewayMessage = match serde_json::from_str(&text) {
                            Ok(msg) => msg,
                            Err(_) => continue,
                        };
                        if parsed.r#type == "res" && parsed.id.as_deref() == Some("connect-1") {
                            if parsed.ok == Some(true) {
                                let device_token = parsed
                                    .payload
                                    .as_ref()
                                    .and_then(|payload| serde_json::from_value::<HelloOkPayload>(payload.clone()).ok())
                                    .and_then(|hello| hello.auth)
                                    .and_then(|auth| auth.device_token);
                                return Ok(device_token);
                            }
                            return Err(format!("握手失败: {}", format_gateway_error(parsed.error.as_ref())));
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        return Err("连接在握手过程中被关闭".to_string());
                    }
                    Some(Err(e)) => {
                        return Err(e.to_string());
                    }
                    Some(_) => {}
                    None => {
                        return Err("连接在握手过程中中断".to_string());
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
        .and_then(|value| value.as_str())?
        .trim()
        .to_string();
    if nonce.is_empty() {
        return None;
    }
    Some(nonce)
}

fn format_connect_async_error(err: tokio_tungstenite::tungstenite::Error) -> String {
    match err {
        tokio_tungstenite::tungstenite::Error::Http(resp) => {
            let status = resp.status();
            let reason = status.canonical_reason().unwrap_or("Unknown");
            let mut message = format!("HTTP {} {}", status.as_u16(), reason);
            if let Some(bytes) = resp.body().as_ref() {
                let body = String::from_utf8_lossy(bytes).trim().to_string();
                if !body.is_empty() {
                    message.push_str(": ");
                    message.push_str(&truncate_text(body, 500));
                }
            }
            message
        }
        other => other.to_string(),
    }
}

fn format_gateway_error(error: Option<&serde_json::Value>) -> String {
    let Some(error) = error else {
        return "未知网关错误".to_string();
    };

    if let Some(message) = error.as_str() {
        return message.to_string();
    }

    let message = error
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("未知网关错误")
        .to_string();

    let mut extras: Vec<String> = Vec::new();
    if let Some(code) = error.get("code").and_then(|v| v.as_str()) {
        extras.push(format!("code={}", code));
    }
    if let Some(reason) = error.get("reason").and_then(|v| v.as_str()) {
        extras.push(format!("reason={}", reason));
    }
    if let Some(status) = error.get("status") {
        extras.push(format!("status={}", compact_json(status, 64)));
    }
    if let Some(details) = error.get("details") {
        extras.push(format!("details={}", compact_json(details, 500)));
    }

    if extras.is_empty() {
        if let Some(obj) = error.as_object() {
            if obj.len() > 1 || !obj.contains_key("message") {
                return format!("{} (raw={})", message, compact_json(error, 500));
            }
        }
        return message;
    }
    format!("{} ({})", message, extras.join(", "))
}

fn compact_json(value: &serde_json::Value, max_len: usize) -> String {
    let raw = if let Some(text) = value.as_str() {
        text.to_string()
    } else {
        serde_json::to_string(value).unwrap_or_else(|_| value.to_string())
    };
    truncate_text(raw, max_len)
}

fn truncate_text(text: String, max_len: usize) -> String {
    if text.chars().count() <= max_len {
        return text;
    }
    let truncated: String = text.chars().take(max_len).collect();
    format!("{}...", truncated)
}

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
        .ok_or_else(|| "缺少设备公钥，无法完成网关握手".to_string())?;
    let private_key = private_key_raw
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "缺少设备私钥，无法完成网关握手".to_string())?;

    let signed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let scopes = NODE_SCOPES.join(",");
    let payload = format!(
        "v3|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
        agent_id,
        NODE_CLIENT_ID,
        NODE_CLIENT_MODE,
        NODE_ROLE,
        scopes,
        signed_at,
        token,
        challenge_nonce,
        std::env::consts::OS,
        NODE_DEVICE_FAMILY
    );
    let signature =
        sign_payload(private_key, &payload).map_err(|e| format!("设备签名失败: {}", e))?;

    Ok(DeviceInfo {
        id: agent_id.to_string(),
        public_key: public_key.to_string(),
        signature,
        signed_at,
        nonce: challenge_nonce.to_string(),
    })
}
