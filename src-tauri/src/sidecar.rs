use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex};

#[derive(Debug, Serialize, Clone)]
pub struct SidecarTask {
    pub task_id: String,
    #[serde(rename = "type")]
    pub task_type: String,
    pub payload: serde_json::Value,
    pub timeout_ms: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SidecarResult {
    pub task_id: String,
    pub status: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub logs: Vec<String>,
}

#[derive(Debug, Serialize)]
struct IpcMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<SidecarTask>,
}

#[derive(Debug, Deserialize)]
struct IpcResponse {
    #[serde(rename = "type")]
    msg_type: String,
    data: Option<SidecarResult>,
}

const MSG_TYPE_RESULT: &str = "result";
const MSG_TYPE_EXECUTE: &str = "execute";
const MSG_TYPE_PING: &str = "ping";

type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<SidecarResult>>>>;

pub struct SidecarManager {
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    pending: PendingMap,
    child: Arc<Mutex<tokio::process::Child>>,
}

impl SidecarManager {
    pub async fn spawn(program: &str, args: &[&str]) -> Result<Self, String> {
        let mut child = Command::new(program)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .map_err(|e| format!("sidecar spawn failed: {}", e))?;

        let stdin = Arc::new(Mutex::new(child.stdin.take().ok_or("no stdin")?));
        let stdout = child.stdout.take().ok_or("no stdout")?;
        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));

        let pending_reader = pending.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        if let Ok(resp) = serde_json::from_str::<IpcResponse>(&line) {
                            if resp.msg_type == MSG_TYPE_RESULT {
                                if let Some(result) = resp.data {
                                    let mut map = pending_reader.lock().await;
                                    if let Some(tx) = map.remove(&result.task_id) {
                                        tx.send(result).ok();
                                    }
                                }
                            }
                        }
                    }
                    Ok(None) => break, // EOF
                    Err(e) => {
                        eprintln!("[sidecar] reader error: {}", e);
                        break;
                    }
                }
            }
        });

        let child = Arc::new(Mutex::new(child));

        Ok(Self {
            stdin,
            pending,
            child,
        })
    }

    pub async fn kill(&self) {
        let mut c = self.child.lock().await;
        let _ = c.kill().await;
    }

    pub async fn execute(&self, task: SidecarTask) -> Result<SidecarResult, String> {
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(task.task_id.clone(), tx);
        self.write_msg(IpcMessage {
            msg_type: MSG_TYPE_EXECUTE.to_string(),
            data: Some(task.clone()),
        })
        .await?;
        let timeout_dur = std::time::Duration::from_millis(task.timeout_ms);
        match tokio::time::timeout(timeout_dur, rx).await {
            Ok(Ok(result)) => Ok(result),
            Ok(Err(_)) => Err("sidecar result channel closed".to_string()),
            Err(_) => {
                // timeout — clean up pending entry to avoid leak
                self.pending.lock().await.remove(&task.task_id);
                Err(format!(
                    "sidecar task {} timed out after {}ms",
                    task.task_id, task.timeout_ms
                ))
            }
        }
    }

    pub async fn ping(&self) -> Result<(), String> {
        self.write_msg(IpcMessage {
            msg_type: MSG_TYPE_PING.to_string(),
            data: None,
        })
        .await
    }

    async fn write_msg(&self, msg: IpcMessage) -> Result<(), String> {
        let line = serde_json::to_string(&msg).map_err(|e| e.to_string())? + "\n";
        self.stdin
            .lock()
            .await
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("sidecar write failed: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_spawn_fails_gracefully() {
        let result = SidecarManager::spawn("nonexistent_program_xyz", &[]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_ping() {
        let mgr = SidecarManager::spawn("node", &["../sidecar/dist/index.js"])
            .await
            .expect("sidecar spawn failed");
        mgr.ping().await.expect("ping failed");
        mgr.kill().await;
    }

    #[tokio::test]
    async fn test_execute_system_run() {
        let mgr = SidecarManager::spawn("node", &["../sidecar/dist/index.js"])
            .await
            .expect("sidecar spawn failed");
        let task = SidecarTask {
            task_id: "t1".to_string(),
            task_type: "system".to_string(),
            payload: serde_json::json!({ "command": "echo hello" }),
            timeout_ms: 5000,
        };
        let result = mgr.execute(task).await.expect("execute failed");
        assert_eq!(result.status, "success");
        mgr.kill().await;
    }

    #[tokio::test]
    async fn test_execute_browser_navigate() {
        let mgr = SidecarManager::spawn("node", &["../sidecar/dist/index.js"])
            .await
            .expect("spawn failed");
        let task = SidecarTask {
            task_id: "b1".to_string(),
            task_type: "browser".to_string(),
            payload: serde_json::json!({
                "command": "browser.navigate",
                "url": "data:text/html,<title>Test</title><h1>hello</h1>"
            }),
            timeout_ms: 60000,
        };
        let result = mgr.execute(task).await.expect("execute failed");
        assert_eq!(result.status, "success");
        let title = result.result.unwrap();
        assert!(title.get("title").is_some());
        mgr.kill().await;
    }
}
