use std::path::{Path, PathBuf};
use std::process::{Output, Stdio};
use std::sync::{Mutex as StdMutex, OnceLock};
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::collections::HashSet;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

const DEFAULT_GATEWAY_PORT: u16 = 18789;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const OPENCLAW_NOT_INSTALLED_CODE: &str = "OPENCLAW_NOT_INSTALLED";
const OPENCLAW_RUNTIME_SOURCE_REL: &str = "runtime/openclaw";
const OPENCLAW_RUNTIME_TARGET_REL: &str = "runtime/openclaw";
const OPENCLAW_RUNTIME_HOME_REL: &str = "runtime-home";

fn contains_binary_not_found_hint(raw: &str) -> bool {
    let lower = raw.to_ascii_lowercase();
    lower.contains("no such file or directory")
        || lower.contains("os error 2")
        || lower.contains("not recognized as an internal or external command")
        || lower.contains("is not recognized")
        || raw.contains("系统找不到指定的文件")
        || raw.contains("找不到指定的文件")
}

fn format_openclaw_not_installed_error(detail: &str) -> String {
    format!(
        "{}: 本机未检测到可用 OpenClaw Runtime，请点击“一键安装内置 Runtime”后重试。\n{}",
        OPENCLAW_NOT_INSTALLED_CODE, detail
    )
}

fn normalize_openclaw_error(raw: String) -> String {
    if contains_binary_not_found_hint(&raw) && raw.to_ascii_lowercase().contains("openclaw") {
        return format_openclaw_not_installed_error(&raw);
    }
    raw
}

#[derive(Debug, Clone, Copy)]
enum GatewayServicePhase {
    Idle,
    Probing,
    Starting,
    Running,
    Stopping,
    Stopped,
    Restarting,
    Error,
}

impl GatewayServicePhase {
    fn as_str(self) -> &'static str {
        match self {
            GatewayServicePhase::Idle => "idle",
            GatewayServicePhase::Probing => "probing",
            GatewayServicePhase::Starting => "starting",
            GatewayServicePhase::Running => "running",
            GatewayServicePhase::Stopping => "stopping",
            GatewayServicePhase::Stopped => "stopped",
            GatewayServicePhase::Restarting => "restarting",
            GatewayServicePhase::Error => "error",
        }
    }
}

#[derive(Debug)]
struct GatewayRuntimeState {
    phase: GatewayServicePhase,
    last_action: String,
    last_message: String,
}

impl Default for GatewayRuntimeState {
    fn default() -> Self {
        Self {
            phase: GatewayServicePhase::Idle,
            last_action: "idle".to_string(),
            last_message: String::new(),
        }
    }
}

fn operation_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn runtime_state() -> &'static StdMutex<GatewayRuntimeState> {
    static STATE: OnceLock<StdMutex<GatewayRuntimeState>> = OnceLock::new();
    STATE.get_or_init(|| StdMutex::new(GatewayRuntimeState::default()))
}

fn update_runtime_state(phase: GatewayServicePhase, action: &str, message: impl Into<String>) {
    if let Ok(mut state) = runtime_state().lock() {
        state.phase = phase;
        state.last_action = action.to_string();
        state.last_message = message.into();
    }
}

fn busy_operation_error() -> String {
    if let Ok(state) = runtime_state().lock() {
        return format!(
            "Gateway 正在执行 {}（phase={}），请稍后重试",
            state.last_action,
            state.phase.as_str()
        );
    }
    "Gateway 正在执行其他操作，请稍后重试".to_string()
}

/// 本地连接结果，返回给前端
#[derive(Debug, Serialize)]
pub struct LocalConnectResult {
    pub gateway_url: String,
    pub gateway_web_ui: String,
    pub token: String,
    pub agent_id: String,
    pub device_name: String,
    /// 兼容旧前端字段：当 local_connect 触发自动拉起时，回传启动摘要
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

fn clatemate_root() -> Result<PathBuf, String> {
    crate::app_paths::app_root_dir()
}

fn bundled_runtime_target_dir() -> Result<PathBuf, String> {
    Ok(clatemate_root()?.join(OPENCLAW_RUNTIME_TARGET_REL))
}

fn bundled_runtime_home_dir() -> Result<PathBuf, String> {
    Ok(clatemate_root()?.join(OPENCLAW_RUNTIME_HOME_REL))
}

#[cfg(target_os = "windows")]
fn bundled_openclaw_wrapper_path() -> Result<PathBuf, String> {
    Ok(clatemate_root()?
        .join("runtime")
        .join("bin")
        .join("openclaw.cmd"))
}

#[cfg(not(target_os = "windows"))]
fn bundled_openclaw_wrapper_path() -> Result<PathBuf, String> {
    Ok(clatemate_root()?
        .join("runtime")
        .join("bin")
        .join("openclaw"))
}

fn bundled_runtime_installed() -> bool {
    bundled_openclaw_wrapper_path()
        .map(|p| p.exists())
        .unwrap_or(false)
}

fn find_workspace(home: PathBuf) -> Result<PathBuf, String> {
    if !system_openclaw_installed() && bundled_runtime_installed() {
        let workspace = bundled_runtime_home_dir()?.join(".openclaw");
        std::fs::create_dir_all(&workspace)
            .map_err(|e| format!("创建内置 runtime 工作空间失败: {}", e))?;
        return Ok(workspace);
    }
    let workspace = home.join(".openclaw");
    if !workspace.exists() {
        return Err(format_openclaw_not_installed_error(
            "未找到 .openclaw 工作空间，无法连接本地网关。",
        ));
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
    if !system_openclaw_installed() && bundled_runtime_installed() {
        if let Ok(runtime_home) = bundled_runtime_home_dir() {
            let workspace = runtime_home.join(".openclaw");
            return read_gateway_settings(&workspace).0;
        }
    }
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

struct CliInvocation {
    program: std::ffi::OsString,
    args: Vec<String>,
}

#[cfg(target_os = "windows")]
fn find_windows_system_openclaw_program() -> Option<PathBuf> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let npm_cmd = PathBuf::from(appdata).join("npm").join("openclaw.cmd");
        if npm_cmd.exists() {
            return Some(npm_cmd);
        }
    }

    let candidates = ["openclaw.cmd", "openclaw.exe", "openclaw.bat", "openclaw"];
    if let Some(path_var) = enhanced_path() {
        for dir in std::env::split_paths(&path_var) {
            for name in candidates {
                let full = dir.join(name);
                if full.exists() {
                    return Some(full);
                }
            }
        }
    }
    None
}

fn system_openclaw_installed() -> bool {
    #[cfg(target_os = "windows")]
    {
        find_windows_system_openclaw_program().is_some()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let candidates = ["openclaw"];
        if let Some(path_var) = enhanced_path() {
            for dir in std::env::split_paths(&path_var) {
                for name in candidates {
                    let full = dir.join(name);
                    if full.exists() {
                        return true;
                    }
                }
            }
        }
        false
    }
}

#[cfg(target_os = "windows")]
fn resolve_windows_openclaw_program() -> std::ffi::OsString {
    if let Some(system_program) = find_windows_system_openclaw_program() {
        return system_program.into_os_string();
    }

    if let Ok(wrapper) = bundled_openclaw_wrapper_path() {
        if wrapper.exists() {
            return wrapper.into_os_string();
        }
    }

    "openclaw.cmd".into()
}

fn build_openclaw_invocation(args: &[&str]) -> CliInvocation {
    #[cfg(target_os = "windows")]
    {
        CliInvocation {
            program: resolve_windows_openclaw_program(),
            args: args.iter().map(|arg| (*arg).to_string()).collect(),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if !system_openclaw_installed() {
            if let Ok(wrapper) = bundled_openclaw_wrapper_path() {
                if wrapper.exists() {
                    return CliInvocation {
                        program: wrapper.into_os_string(),
                        args: args.iter().map(|arg| (*arg).to_string()).collect(),
                    };
                }
            }
        }
        CliInvocation {
            program: "openclaw".into(),
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
    cmd.output().await.map_err(|e| {
        normalize_openclaw_error(format!("执行 openclaw {} 失败: {}", args.join(" "), e))
    })
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
        .map_err(|e| normalize_openclaw_error(format!("启动 openclaw gateway 失败: {}", e)))?;
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

    let _guard = operation_lock()
        .try_lock()
        .map_err(|_| busy_operation_error())?;

    let port = resolve_gateway_port();
    let phase = match action.as_str() {
        "start" => GatewayServicePhase::Starting,
        "stop" => GatewayServicePhase::Stopping,
        "restart" => GatewayServicePhase::Restarting,
        _ => GatewayServicePhase::Idle,
    };
    update_runtime_state(phase, &action, format!("开始执行 {}", action));

    let result = match action.as_str() {
        "start" => start_gateway_service(port).await,
        "stop" => stop_gateway_service(port).await,
        "restart" => restart_gateway_service(port).await,
        _ => unreachable!(),
    };

    match (&action[..], &result) {
        ("start", Ok(msg)) | ("restart", Ok(msg)) => {
            update_runtime_state(GatewayServicePhase::Running, &action, msg.clone())
        }
        ("stop", Ok(msg)) => {
            update_runtime_state(GatewayServicePhase::Stopped, &action, msg.clone())
        }
        (_, Err(err)) => update_runtime_state(GatewayServicePhase::Error, &action, err.clone()),
        _ => {}
    }

    result
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.exists() {
        return Err(format!("Runtime 源目录不存在: {}", src.display()));
    }
    std::fs::create_dir_all(dst).map_err(|e| format!("创建目录失败 {}: {}", dst.display(), e))?;
    for entry in
        std::fs::read_dir(src).map_err(|e| format!("读取目录失败 {}: {}", src.display(), e))?
    {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            if let Some(parent) = dst_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败 {}: {}", parent.display(), e))?;
            }
            std::fs::copy(&src_path, &dst_path).map_err(|e| {
                format!(
                    "复制文件失败 {} -> {}: {}",
                    src_path.display(),
                    dst_path.display(),
                    e
                )
            })?;
        }
    }
    Ok(())
}

fn runtime_source_usable(path: &Path) -> bool {
    let entry = path.join("openclaw.mjs");
    let dist_entry_js = path.join("dist").join("entry.js");
    let dist_entry_mjs = path.join("dist").join("entry.mjs");
    entry.exists() && (dist_entry_js.exists() || dist_entry_mjs.exists())
}

#[cfg(target_os = "windows")]
fn system_runtime_source_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(program) = find_windows_system_openclaw_program() {
        if let Some(parent) = program.parent() {
            candidates.push(parent.join("openclaw"));
            candidates.push(parent.join("../openclaw"));
        }
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        candidates.push(
            PathBuf::from(&appdata)
                .join("npm")
                .join("node_modules")
                .join("openclaw"),
        );
        candidates.push(
            PathBuf::from(&appdata)
                .join("npm")
                .join("node_modules")
                .join("@openclaw")
                .join("openclaw"),
        );
    }
    candidates
}

#[cfg(not(target_os = "windows"))]
fn system_runtime_source_candidates() -> Vec<PathBuf> {
    Vec::new()
}

fn locate_embedded_runtime_source(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("无法定位资源目录: {}", e))?;
    let bundled = resource_dir.join(OPENCLAW_RUNTIME_SOURCE_REL);
    if runtime_source_usable(&bundled) {
        return Ok(bundled);
    }

    // Dev fallback: allow local workspace runtime source for development.
    if cfg!(debug_assertions) {
        let mut candidates = vec![
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../openclaw-runtime"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../openclaw"),
        ];
        candidates.extend(system_runtime_source_candidates());

        for candidate in candidates {
            if runtime_source_usable(&candidate) {
                return Ok(candidate);
            }
        }
    }

    Err(format_openclaw_not_installed_error(
        "当前安装包未包含内置 OpenClaw Runtime，请使用包含 Runtime 的构建包。",
    ))
}

fn write_openclaw_wrapper(runtime_root: &Path, runtime_home: &Path) -> Result<(), String> {
    let bin_dir = clatemate_root()?.join("runtime").join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("创建 runtime bin 目录失败: {}", e))?;
    std::fs::create_dir_all(runtime_home).map_err(|e| format!("创建 runtime home 失败: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        let wrapper = bin_dir.join("openclaw.cmd");
        let node_exe = runtime_root.join("node").join("node.exe");
        let openclaw_entry = runtime_root.join("openclaw.mjs");
        let script = format!(
            "@echo off\r\nsetlocal\r\nset \"HOME={}\"\r\nset \"USERPROFILE={}\"\r\nset \"OPENCLAW_HOME={}\"\r\nset \"NODE_EXE={}\"\r\nif not exist \"%NODE_EXE%\" set \"NODE_EXE=node\"\r\nset \"OPENCLAW_ENTRY={}\"\r\n\"%NODE_EXE%\" \"%OPENCLAW_ENTRY%\" %*\r\n",
            runtime_home.display(),
            runtime_home.display(),
            runtime_home.display(),
            node_exe.display(),
            openclaw_entry.display(),
        );
        std::fs::write(&wrapper, script)
            .map_err(|e| format!("写入 openclaw.cmd 失败 {}: {}", wrapper.display(), e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let wrapper = bin_dir.join("openclaw");
        let node_exe = runtime_root.join("node").join("bin").join("node");
        let openclaw_entry = runtime_root.join("openclaw.mjs");
        let script = format!(
            "#!/usr/bin/env bash\nset -euo pipefail\nexport HOME=\"{}\"\nexport OPENCLAW_HOME=\"{}\"\nNODE_EXE=\"{}\"\nif [ ! -x \"$NODE_EXE\" ]; then NODE_EXE=\"node\"; fi\nOPENCLAW_ENTRY=\"{}\"\nexec \"$NODE_EXE\" \"$OPENCLAW_ENTRY\" \"$@\"\n",
            runtime_home.display(),
            runtime_home.display(),
            node_exe.display(),
            openclaw_entry.display(),
        );
        std::fs::write(&wrapper, script)
            .map_err(|e| format!("写入 openclaw wrapper 失败 {}: {}", wrapper.display(), e))?;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&wrapper, perms)
            .map_err(|e| format!("设置 wrapper 可执行权限失败 {}: {}", wrapper.display(), e))?;
    }
    Ok(())
}

async fn install_openclaw_package(app: tauri::AppHandle) -> Result<String, String> {
    let _guard = operation_lock()
        .try_lock()
        .map_err(|_| busy_operation_error())?;
    update_runtime_state(
        GatewayServicePhase::Starting,
        "install_openclaw_cli",
        "开始安装内置 OpenClaw Runtime",
    );

    let source = locate_embedded_runtime_source(&app)?;
    let runtime_target = bundled_runtime_target_dir()?;
    if runtime_target.exists() {
        std::fs::remove_dir_all(&runtime_target).map_err(|e| {
            format!(
                "清理旧 Runtime 目录失败 {}: {}",
                runtime_target.display(),
                e
            )
        })?;
    }
    copy_dir_recursive(&source, &runtime_target)?;
    let runtime_home = bundled_runtime_home_dir()?;
    write_openclaw_wrapper(&runtime_target, &runtime_home)?;

    let summary = format!(
        "内置 OpenClaw Runtime 安装完成: {}",
        runtime_target.display()
    );
    update_runtime_state(
        GatewayServicePhase::Idle,
        "install_openclaw_cli",
        summary.clone(),
    );
    Ok(summary)
}

async fn discover_or_bootstrap_gateway(base_port: u16) -> Result<(u16, Option<String>), String> {
    match discover_gateway_port(base_port).await {
        Ok(port) => {
            update_runtime_state(
                GatewayServicePhase::Running,
                "local_connect",
                format!("探测到在线 gateway 端口: {}", port),
            );
            Ok((port, None))
        }
        Err(probe_error) => {
            update_runtime_state(
                GatewayServicePhase::Starting,
                "local_connect",
                format!("探测失败，尝试启动: {}", probe_error),
            );
            let start_message = start_gateway_service(base_port).await?;
            let port = discover_gateway_port(base_port)
                .await
                .map_err(|discover_err| {
                    format!(
                        "{}\n启动后仍未探测到可用 gateway: {}",
                        start_message, discover_err
                    )
                })?;
            update_runtime_state(
                GatewayServicePhase::Running,
                "local_connect",
                format!("自动拉起后已连接端口: {}", port),
            );
            Ok((port, Some(start_message)))
        }
    }
}

// ─── Tauri Command ───────────────────────────────────────────────

#[tauri::command]
pub async fn local_connect(app: tauri::AppHandle) -> Result<LocalConnectResult, String> {
    use tauri::Manager;

    let _guard = operation_lock()
        .try_lock()
        .map_err(|_| busy_operation_error())?;
    update_runtime_state(
        GatewayServicePhase::Probing,
        "local_connect",
        "开始探测本地 Gateway",
    );

    // 1. 找工作空间
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("无法获取用户主目录: {}", e))?;
    let workspace = find_workspace(home).inspect_err(|err| {
        update_runtime_state(GatewayServicePhase::Error, "local_connect", err.clone())
    })?;

    // 2. 读取配置中的 gateway 端口和 token（只读）
    let (base_port, token) = read_gateway_settings(&workspace);

    // 3. 探测在线端口；若探测失败，则自动启动后再探测
    let (port, recovery_message) =
        discover_or_bootstrap_gateway(base_port)
            .await
            .inspect_err(|err| {
                update_runtime_state(GatewayServicePhase::Error, "local_connect", err.clone())
            })?;

    // 4. 加载 device identity
    let identity =
        crate::device_identity::load_or_create_device_identity(&app).inspect_err(|err| {
            update_runtime_state(GatewayServicePhase::Error, "local_connect", err.clone())
        })?;

    let gateway_web_ui = if token.is_empty() {
        format!("http://127.0.0.1:{}", port)
    } else {
        format!("http://127.0.0.1:{}/#token={}", port, token)
    };
    update_runtime_state(
        GatewayServicePhase::Running,
        "local_connect",
        format!("本地 Gateway 已就绪: ws://127.0.0.1:{}", port),
    );

    Ok(LocalConnectResult {
        gateway_url: format!("ws://127.0.0.1:{}", port),
        gateway_web_ui,
        token,
        agent_id: identity.device_id.clone(),
        device_name: format!("openclaw-mate-{}", &identity.device_id[..8]),
        restart_log: recovery_message,
    })
}

#[tauri::command]
pub async fn local_gateway_daemon(action: String) -> Result<String, String> {
    run_gateway_action(&action).await
}

#[tauri::command]
pub async fn install_openclaw_cli(app: tauri::AppHandle) -> Result<String, String> {
    install_openclaw_package(app).await
}

#[cfg(test)]
mod tests {
    use super::build_openclaw_invocation;
    use super::GatewayServicePhase;

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_invocation_prefers_openclaw_binary_without_cmd_wrapper() {
        let invocation = build_openclaw_invocation(&["daemon", "start"]);
        let program = invocation.program.to_string_lossy().to_ascii_lowercase();
        assert!(program.contains("openclaw"));
        assert_eq!(
            invocation.args,
            vec!["daemon".to_string(), "start".to_string()]
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

    #[test]
    fn service_phase_labels_are_stable() {
        assert_eq!(GatewayServicePhase::Idle.as_str(), "idle");
        assert_eq!(GatewayServicePhase::Probing.as_str(), "probing");
        assert_eq!(GatewayServicePhase::Starting.as_str(), "starting");
        assert_eq!(GatewayServicePhase::Running.as_str(), "running");
        assert_eq!(GatewayServicePhase::Stopping.as_str(), "stopping");
        assert_eq!(GatewayServicePhase::Stopped.as_str(), "stopped");
        assert_eq!(GatewayServicePhase::Restarting.as_str(), "restarting");
        assert_eq!(GatewayServicePhase::Error.as_str(), "error");
    }
}
