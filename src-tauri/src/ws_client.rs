use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message};

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
                        device: DeviceInfo {
                            id: agent_id_clone,
                            display_name: device_name_clone,
                        },
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
                } else {
                    // 握手失败（可能是 pairing required）
                    let err_msg = msg.error
                        .and_then(|e| e.get("message").and_then(|m| m.as_str().map(|s| s.to_string())))
                        .unwrap_or_else(|| "握手失败".to_string());
                    app.emit("ws:error", err_msg).ok();
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
                                timeout_ms: 30000,
                            };
                            app.emit("ws:task", &task).ok();

                            // 执行命令
                            let result = execute_command(&invoke_params.command, &invoke_params.args).await;

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

/// 执行命令（目前仅支持 system.run）
async fn execute_command(command: &str, args: &serde_json::Value) -> TaskResult {
    let start = std::time::Instant::now();

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
