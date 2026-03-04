use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WsTask {
    pub task_id: String,
    pub r#type: String,
    pub payload: serde_json::Value,
    pub require_approval: bool,
    pub timeout_ms: u64,
}

#[tauri::command]
pub async fn connect_gateway(
    app: tauri::AppHandle,
    gateway_url: String,
    token: String,
) -> Result<(), String> {
    let url = format!("{}?token={}", gateway_url, token);

    tauri::async_runtime::spawn(async move {
        match connect_async(&url).await {
            Ok((ws_stream, _)) => {
                app.emit("ws:connected", ()).ok();

                let (_, mut read) = ws_stream.split();

                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            if let Ok(task) = serde_json::from_str::<WsTask>(&text) {
                                app.emit("ws:task", &task).ok();
                            }
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
            }
            Err(e) => {
                app.emit("ws:error", e.to_string()).ok();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn disconnect_gateway() -> Result<(), String> {
    // 后续版本实现通过共享状态断开连接
    Ok(())
}
