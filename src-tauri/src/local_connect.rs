use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// 本地连接结果，返回给前端
#[derive(Debug, Serialize)]
pub struct LocalConnectResult {
    pub gateway_url: String,
    pub gateway_web_ui: String,
    pub token: String,
    pub agent_id: String,
    pub device_name: String,
    /// 兼容旧前端字段：当前实现不再修改本地配置或重启服务
    pub restart_log: Option<String>,
}

/// openclaw.json gateway 字段子集
#[derive(Debug, Deserialize)]
struct OpenClawConfig {
    gateway: Option<GatewayConfig>,
}

#[derive(Debug, Deserialize)]
struct GatewayConfig {
    port: Option<u16>,
    auth: Option<GatewayAuthConfig>,
}

#[derive(Debug, Deserialize)]
struct GatewayAuthConfig {
    token: Option<String>,
}

// ─── 工作空间 ────────────────────────────────────────────────────

fn find_workspace(home: PathBuf) -> Result<PathBuf, String> {
    let workspace = home.join(".openclaw");
    if !workspace.exists() {
        return Err("未找到 .openclaw 工作空间，请确认 openclaw 已本地安装".to_string());
    }
    Ok(workspace)
}

fn read_gateway_settings(workspace: &PathBuf) -> (u16, String) {
    let config_path = workspace.join("openclaw.json");
    if let Ok(content) = std::fs::read_to_string(config_path) {
        if let Ok(config) = serde_json::from_str::<OpenClawConfig>(&content) {
            if let Some(gw) = config.gateway {
                let port = gw.port.unwrap_or(18789);
                let token = gw
                    .auth
                    .and_then(|auth| auth.token)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                return (port, token);
            }
        }
    }
    (18789, String::new())
}

// ─── 端口探测 ────────────────────────────────────────────────────

async fn discover_gateway_port(base_port: u16) -> Result<u16, String> {
    for port in base_port..=(base_port + 10) {
        if tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port))
            .await
            .is_ok()
        {
            return Ok(port);
        }
    }
    Err(format!(
        "未找到在线的 openclaw gateway（扫描 {}~{}），请确认服务已启动",
        base_port,
        base_port + 10
    ))
}

async fn run_openclaw_daemon(action: &str) -> Result<String, String> {
    let action = action.trim().to_lowercase();
    if action != "start" && action != "stop" && action != "restart" {
        return Err("仅支持 start / stop / restart".to_string());
    }

    let script = format!("openclaw daemon {}", action);
    let output = if cfg!(target_os = "windows") {
        tokio::process::Command::new("cmd")
            .args(["/C", &script])
            .output()
            .await
            .map_err(|e| format!("执行本地网关命令失败: {}", e))?
    } else {
        tokio::process::Command::new("sh")
            .args(["-c", &script])
            .output()
            .await
            .map_err(|e| format!("执行本地网关命令失败: {}", e))?
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let merged = if stderr.is_empty() {
        stdout.clone()
    } else if stdout.is_empty() {
        stderr.clone()
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    if output.status.success() {
        // 某些环境里 daemon 命令会返回成功，但提示服务未安装（实际上不会启动）
        // 这时回退到 `openclaw gateway` 直接拉起本地网关进程。
        if (action == "start" || action == "restart") && merged.contains("Gateway service missing") {
            let fallback = run_openclaw_gateway_detached().await?;
            if merged.is_empty() {
                Ok(fallback)
            } else {
                Ok(format!("{}\n{}", merged, fallback))
            }
        } else if merged.is_empty() {
            Ok(format!("openclaw daemon {} ok", action))
        } else {
            Ok(merged)
        }
    } else {
        let msg = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("openclaw daemon {} failed", action)
        };
        Err(msg)
    }
}

async fn run_openclaw_gateway_detached() -> Result<String, String> {
    let output = if cfg!(target_os = "windows") {
        tokio::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Start-Process -FilePath 'openclaw' -ArgumentList 'gateway' -WindowStyle Hidden",
            ])
            .output()
            .await
            .map_err(|e| format!("执行 openclaw gateway 启动命令失败: {}", e))?
    } else {
        tokio::process::Command::new("sh")
            .args(["-c", "nohup openclaw gateway >/tmp/openclaw-gateway.log 2>&1 &"])
            .output()
            .await
            .map_err(|e| format!("执行 openclaw gateway 启动命令失败: {}", e))?
    };

    if output.status.success() {
        Ok("已尝试使用 openclaw gateway 启动本地网关进程".to_string())
    } else {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let msg = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            "openclaw gateway 启动命令执行失败".to_string()
        };
        Err(msg)
    }
}

// ─── Tauri Command ───────────────────────────────────────────────

#[tauri::command]
pub async fn local_connect(app: tauri::AppHandle) -> Result<LocalConnectResult, String> {
    use tauri::Manager;

    // 1. 找工作空间
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("无法获取用户主目录: {}", e))?;
    let workspace = find_workspace(home)?;

    // 2. 读取配置中的 gateway 端口和 token（只读）
    let (base_port, token) = read_gateway_settings(&workspace);

    // 3. 探测在线的 gateway 端口
    let port = discover_gateway_port(base_port).await?;

    // 4. 加载 device identity
    let identity = crate::device_identity::load_or_create_device_identity(&app)?;

    let gateway_web_ui = if token.is_empty() {
        format!("http://127.0.0.1:{}", port)
    } else {
        format!("http://127.0.0.1:{}/#token={}", port, token)
    };

    Ok(LocalConnectResult {
        gateway_url: format!("ws://127.0.0.1:{}", port),
        gateway_web_ui,
        token,
        agent_id: identity.device_id.clone(),
        device_name: format!("openclaw-mate-{}", &identity.device_id[..8]),
        restart_log: None,
    })
}

#[tauri::command]
pub async fn local_gateway_daemon(action: String) -> Result<String, String> {
    run_openclaw_daemon(&action).await
}
