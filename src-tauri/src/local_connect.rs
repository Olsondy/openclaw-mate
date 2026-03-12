use std::path::PathBuf;
use std::process::{Output, Stdio};
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::collections::HashSet;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};

const DEFAULT_GATEWAY_PORT: u16 = 18789;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
                let port = gw.port.unwrap_or(DEFAULT_GATEWAY_PORT);
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
    (DEFAULT_GATEWAY_PORT, String::new())
}

fn resolve_gateway_port() -> u16 {
    if let Some(home) = dirs::home_dir() {
        let workspace = home.join(".openclaw");
        return read_gateway_settings(&workspace).0;
    }
    DEFAULT_GATEWAY_PORT
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

fn enhanced_path() -> Option<std::ffi::OsString> {
    let mut paths: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|value| std::env::split_paths(&value).collect())
        .unwrap_or_default();

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let npm_dir = PathBuf::from(appdata).join("npm");
            if npm_dir.exists() && !paths.iter().any(|item| item == &npm_dir) {
                paths.push(npm_dir);
            }
        }
    }

    std::env::join_paths(paths).ok()
}

fn apply_path_env_to_tokio_command(cmd: &mut tokio::process::Command) {
    if let Some(path) = enhanced_path() {
        cmd.env("PATH", path);
    }
}

fn apply_path_env_to_std_command(cmd: &mut std::process::Command) {
    if let Some(path) = enhanced_path() {
        cmd.env("PATH", path);
    }
}

fn hide_window_for_tokio_command(cmd: &mut tokio::process::Command) {
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn hide_window_for_std_command(cmd: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

struct OpenClawInvocation {
    program: &'static str,
    args: Vec<String>,
}

fn build_openclaw_invocation(args: &[&str]) -> OpenClawInvocation {
    #[cfg(target_os = "windows")]
    {
        let mut merged = vec!["/C".to_string(), "openclaw".to_string()];
        merged.extend(args.iter().map(|arg| (*arg).to_string()));
        OpenClawInvocation {
            program: "cmd",
            args: merged,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        OpenClawInvocation {
            program: "openclaw",
            args: args.iter().map(|arg| (*arg).to_string()).collect(),
        }
    }
}

async fn run_openclaw_command(args: &[&str]) -> Result<Output, String> {
    let invocation = build_openclaw_invocation(args);
    let mut cmd = tokio::process::Command::new(invocation.program);
    cmd.args(invocation.args);
    apply_path_env_to_tokio_command(&mut cmd);
    hide_window_for_tokio_command(&mut cmd);
    cmd.output()
        .await
        .map_err(|e| format!("执行 openclaw {} 失败: {}", args.join(" "), e))
}

fn merge_command_output(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        stdout
    } else if stdout.is_empty() {
        stderr
    } else {
        format!("{}\n{}", stdout, stderr)
    }
}

fn has_service_missing_hint(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.contains("gateway service missing")
        || lower.contains("service missing")
        || lower.contains("openclaw gateway install")
}

#[cfg(not(target_os = "windows"))]
fn is_port_open(port: u16) -> bool {
    let addr = format!("127.0.0.1:{port}");
    let socket = match addr.parse() {
        Ok(value) => value,
        Err(_) => return false,
    };
    std::net::TcpStream::connect_timeout(&socket, Duration::from_millis(350)).is_ok()
}

#[cfg(target_os = "windows")]
fn looks_like_gateway_command_line(command_line: &str) -> bool {
    let text = command_line.to_ascii_lowercase();
    text.contains("openclaw") && text.contains("gateway")
}

#[cfg(target_os = "windows")]
fn parse_listening_pids_from_netstat(stdout: &str, port: u16) -> Vec<u32> {
    let port_pattern = format!(":{port}");
    let mut pids = HashSet::new();

    for line in stdout.lines() {
        let trimmed = line.trim();
        if !(trimmed.contains("LISTENING") || trimmed.contains("侦听")) {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }

        let Some(local_addr) = parts.get(1) else {
            continue;
        };
        if !local_addr.ends_with(&port_pattern) {
            continue;
        }

        if let Ok(pid) = parts[4].parse::<u32>() {
            if pid > 0 {
                pids.insert(pid);
            }
        }
    }

    let mut ordered: Vec<u32> = pids.into_iter().collect();
    ordered.sort_unstable();
    ordered
}

#[cfg(target_os = "windows")]
fn query_listening_pids(port: u16) -> Result<Vec<u32>, String> {
    let mut cmd = std::process::Command::new("netstat");
    cmd.args(["-ano"]);
    hide_window_for_std_command(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("netstat 执行失败: {}", e))?;
    Ok(parse_listening_pids_from_netstat(
        &String::from_utf8_lossy(&output.stdout),
        port,
    ))
}

#[cfg(target_os = "windows")]
fn query_process_command_line(pid: u32) -> Option<String> {
    let script = format!(
        r#"$p = Get-CimInstance Win32_Process -Filter "ProcessId = {pid}"; if ($p) {{ [Console]::Out.Write($p.CommandLine) }}"#
    );

    let mut cmd = std::process::Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-Command", &script]);
    hide_window_for_std_command(&mut cmd);
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

#[cfg(target_os = "windows")]
fn inspect_port_owners(port: u16) -> Result<(Vec<u32>, Vec<u32>), String> {
    let listening_pids = query_listening_pids(port)?;
    let mut gateway_pids: Vec<u32> = Vec::new();
    let mut foreign_pids: Vec<u32> = Vec::new();

    for pid in listening_pids {
        match query_process_command_line(pid) {
            Some(command_line) if looks_like_gateway_command_line(&command_line) => {
                gateway_pids.push(pid);
            }
            Some(command_line) if !command_line.is_empty() => {
                foreign_pids.push(pid);
            }
            _ => {
                // 命令行读不到时，按 Gateway 处理，避免权限限制导致误报 foreign
                gateway_pids.push(pid);
            }
        }
    }

    gateway_pids.sort_unstable();
    gateway_pids.dedup();
    foreign_pids.sort_unstable();
    foreign_pids.dedup();
    Ok((gateway_pids, foreign_pids))
}

#[cfg(target_os = "windows")]
fn format_pid_list(pids: &[u32]) -> String {
    pids.iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(", ")
}

fn gateway_running(port: u16) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let (gateway_pids, _) = inspect_port_owners(port)?;
        Ok(!gateway_pids.is_empty())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(is_port_open(port))
    }
}

async fn wait_until_running(port: u16, timeout_ms: u64) -> Result<bool, String> {
    let start = Instant::now();
    loop {
        if gateway_running(port)? {
            return Ok(true);
        }
        if start.elapsed() >= Duration::from_millis(timeout_ms) {
            return Ok(false);
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

async fn wait_until_stopped(port: u16, timeout_ms: u64) -> Result<bool, String> {
    let start = Instant::now();
    loop {
        if !gateway_running(port)? {
            return Ok(true);
        }
        if start.elapsed() >= Duration::from_millis(timeout_ms) {
            return Ok(false);
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

fn create_gateway_log_files() -> Result<(std::fs::File, std::fs::File), String> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let log_dir = dirs::home_dir()
        .unwrap_or_default()
        .join(".openclaw")
        .join("logs");
    std::fs::create_dir_all(&log_dir).map_err(|e| format!("创建日志目录失败: {}", e))?;

    let mut stdout_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("gateway.log"))
        .map_err(|e| format!("创建 gateway.log 失败: {}", e))?;
    let stderr_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("gateway.err.log"))
        .map_err(|e| format!("创建 gateway.err.log 失败: {}", e))?;

    let now_unix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    let _ = writeln!(stdout_log, "\n[{}] [Mate] Hidden-start Gateway", now_unix);

    Ok((stdout_log, stderr_log))
}

fn spawn_gateway_detached() -> Result<(), String> {
    let (stdout_log, stderr_log) = create_gateway_log_files()?;
    let invocation = build_openclaw_invocation(&["gateway"]);
    let mut cmd = std::process::Command::new(invocation.program);
    cmd.args(invocation.args);
    apply_path_env_to_std_command(&mut cmd);
    hide_window_for_std_command(&mut cmd);
    cmd.stdin(Stdio::null())
        .stdout(stdout_log)
        .stderr(stderr_log)
        .spawn()
        .map_err(|e| format!("启动 openclaw gateway 失败: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn force_kill_gateway_pid(pid: u32) {
    let mut cmd = std::process::Command::new("taskkill");
    cmd.args(["/f", "/t", "/pid", &pid.to_string()]);
    hide_window_for_std_command(&mut cmd);
    let _ = cmd.output();
}

async fn start_gateway_service(port: u16) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let (gateway_pids, foreign_pids) = inspect_port_owners(port)?;
        if !gateway_pids.is_empty() {
            return Ok(format!(
                "Gateway 已在运行 (PID: {})",
                format_pid_list(&gateway_pids)
            ));
        }
        if !foreign_pids.is_empty() {
            return Err(format!(
                "端口 {port} 已被非 Gateway 进程占用 (PID: {})，已阻止启动",
                format_pid_list(&foreign_pids)
            ));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if gateway_running(port)? {
            return Ok(format!("Gateway 已在运行 (127.0.0.1:{port})"));
        }
    }

    let (daemon_success, daemon_message) = match run_openclaw_command(&["daemon", "start"]).await {
        Ok(output) => (output.status.success(), merge_command_output(&output)),
        Err(err) => (false, err),
    };

    if daemon_success && wait_until_running(port, 4_000).await? {
        if daemon_message.is_empty() {
            return Ok("openclaw daemon start 成功".to_string());
        }
        return Ok(daemon_message);
    }

    if !daemon_message.is_empty() && !has_service_missing_hint(&daemon_message) {
        eprintln!(
            "[local_gateway_daemon] daemon start 未就绪，将回退进程直启: {}",
            daemon_message
        );
    }

    spawn_gateway_detached()?;
    if wait_until_running(port, 10_000).await? {
        if daemon_message.is_empty() {
            return Ok("Gateway 已启动（进程直启）".to_string());
        }
        return Ok(format!("{}\nGateway 已启动（进程直启）", daemon_message));
    }

    if daemon_message.is_empty() {
        Err("Gateway 启动超时，请检查 ~/.openclaw/logs/gateway.err.log".to_string())
    } else {
        Err(format!(
            "{}\nGateway 启动超时，请检查 ~/.openclaw/logs/gateway.err.log",
            daemon_message
        ))
    }
}

async fn stop_gateway_service(port: u16) -> Result<String, String> {
    let mut notes: Vec<String> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let (gateway_pids, foreign_pids) = inspect_port_owners(port)?;
        if gateway_pids.is_empty() {
            if !foreign_pids.is_empty() {
                return Err(format!(
                    "端口 {port} 当前由非 Gateway 进程占用 (PID: {})，已拒绝停止以避免误杀",
                    format_pid_list(&foreign_pids)
                ));
            }
            return Ok("Gateway 已停止".to_string());
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if !gateway_running(port)? {
            return Ok("Gateway 已停止".to_string());
        }
    }

    if let Ok(output) = run_openclaw_command(&["daemon", "stop"]).await {
        let msg = merge_command_output(&output);
        if !msg.is_empty() {
            notes.push(msg);
        }
    }
    if wait_until_stopped(port, 4_000).await? {
        if notes.is_empty() {
            return Ok("Gateway 已停止".to_string());
        }
        return Ok(notes.join("\n"));
    }

    if let Ok(output) = run_openclaw_command(&["gateway", "stop"]).await {
        let msg = merge_command_output(&output);
        if !msg.is_empty() {
            notes.push(msg);
        }
    }
    if wait_until_stopped(port, 4_000).await? {
        if notes.is_empty() {
            return Ok("Gateway 已停止".to_string());
        }
        return Ok(notes.join("\n"));
    }

    #[cfg(target_os = "windows")]
    {
        let (gateway_pids, foreign_pids) = inspect_port_owners(port)?;
        if gateway_pids.is_empty() {
            if !foreign_pids.is_empty() {
                return Err(format!(
                    "端口 {port} 当前由非 Gateway 进程占用 (PID: {})，已拒绝停止以避免误杀",
                    format_pid_list(&foreign_pids)
                ));
            }
            if notes.is_empty() {
                return Ok("Gateway 已停止".to_string());
            }
            return Ok(notes.join("\n"));
        }

        for pid in gateway_pids {
            force_kill_gateway_pid(pid);
        }

        if wait_until_stopped(port, 4_000).await? {
            notes.push("已强制终止 Gateway 进程".to_string());
            return Ok(notes.join("\n"));
        }

        let (remain, _) = inspect_port_owners(port)?;
        if remain.is_empty() {
            if notes.is_empty() {
                return Ok("Gateway 已停止".to_string());
            }
            return Ok(notes.join("\n"));
        }

        return Err(format!(
            "停止 Gateway 失败，端口 {port} 仍被 Gateway 进程占用 (PID: {})",
            format_pid_list(&remain)
        ));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(format!("停止 Gateway 失败，端口 {port} 仍处于监听状态"))
    }
}

async fn restart_gateway_service(port: u16) -> Result<String, String> {
    let stop_message = stop_gateway_service(port).await?;
    let start_message = start_gateway_service(port).await?;
    if stop_message.trim().is_empty() {
        return Ok(start_message);
    }
    if start_message.trim().is_empty() {
        return Ok(stop_message);
    }
    Ok(format!("{}\n{}", stop_message, start_message))
}

async fn run_gateway_action(action: &str) -> Result<String, String> {
    let action = action.trim().to_lowercase();
    if action != "start" && action != "stop" && action != "restart" {
        return Err("仅支持 start / stop / restart".to_string());
    }

    let port = resolve_gateway_port();
    match action.as_str() {
        "start" => start_gateway_service(port).await,
        "stop" => stop_gateway_service(port).await,
        "restart" => restart_gateway_service(port).await,
        _ => unreachable!(),
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
    run_gateway_action(&action).await
}

#[cfg(test)]
mod tests {
    use super::build_openclaw_invocation;

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_invocation_uses_cmd_wrapper() {
        let invocation = build_openclaw_invocation(&["daemon", "start"]);
        assert_eq!(invocation.program, "cmd");
        assert_eq!(
            invocation.args,
            vec![
                "/C".to_string(),
                "openclaw".to_string(),
                "daemon".to_string(),
                "start".to_string()
            ]
        );
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn unix_invocation_calls_openclaw_directly() {
        let invocation = build_openclaw_invocation(&["daemon", "start"]);
        assert_eq!(invocation.program, "openclaw");
        assert_eq!(
            invocation.args,
            vec!["daemon".to_string(), "start".to_string()]
        );
    }
}
