use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

// ─── 目录 ─────────────────────────────────────────────────────────────────────

fn get_clatemate_dir() -> Result<PathBuf, String> {
    crate::app_paths::app_root_dir()
}

fn profiles_dir() -> Result<PathBuf, String> {
    crate::app_paths::app_profiles_dir()
}

// ─── 数据结构 ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// null = 首次启动未选择，"license" | "local"
    pub connection_mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfigSnapshot {
    pub provider: String,
    pub model_id: String,
    pub model_name: String,
    pub base_url: String,
}

/// License 模式的完整 profile（切走后保留，切回来直接加载）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LicenseProfile {
    pub license_key: String,
    pub license_id: Option<i64>,
    pub gateway_endpoint: String,
    pub gateway_web_ui: String,
    pub expiry_date: String,
    pub model_config_snapshot: Option<ModelConfigSnapshot>,
    pub approval_rules: Option<serde_json::Value>,
}

/// Local 模式的完整 profile（切走后保留，切回来直接加载）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalProfile {
    pub gateway_url: String,
    pub gateway_web_ui: String,
    pub agent_id: String,
    pub device_name: String,
    pub last_connected_at: String,
}

// ─── 文件读写工具 ─────────────────────────────────────────────────────────────

fn read_json<T: for<'de> Deserialize<'de> + Default>(path: &PathBuf) -> T {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(path: &PathBuf, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_app_config() -> Result<AppConfig, String> {
    let dir = get_clatemate_dir()?;
    Ok(read_json(&dir.join("config.json")))
}

#[tauri::command]
pub fn save_app_config(config: AppConfig) -> Result<(), String> {
    let dir = get_clatemate_dir()?;
    write_json(&dir.join("config.json"), &config)
}

#[tauri::command]
pub fn get_license_profile() -> Result<Option<LicenseProfile>, String> {
    let path = profiles_dir()?.join("license.json");
    if !path.exists() {
        return Ok(None);
    }
    Ok(fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok()))
}

#[tauri::command]
pub fn save_license_profile(profile: LicenseProfile) -> Result<(), String> {
    write_json(&profiles_dir()?.join("license.json"), &profile)
}

#[tauri::command]
pub fn get_local_profile() -> Result<Option<LocalProfile>, String> {
    let path = profiles_dir()?.join("local.json");
    if !path.exists() {
        return Ok(None);
    }
    Ok(fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok()))
}

#[tauri::command]
pub fn save_local_profile(profile: LocalProfile) -> Result<(), String> {
    write_json(&profiles_dir()?.join("local.json"), &profile)
}

/// 将当前 license 配置导出为 JSON 快照文件，保存至 ~/.clatemate/exports/
/// 返回文件路径字符串，供前端展示给用户
#[tauri::command]
pub fn export_config_snapshot(profile: LicenseProfile) -> Result<String, String> {
    let exports_dir = crate::app_paths::app_exports_dir()?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let path = exports_dir.join(format!("config-export-{}.json", ts));

    let export = serde_json::json!({
        "exportedAt": ts,
        "licenseKey": profile.license_key,
        "licenseId": profile.license_id,
        "gatewayWebUI": profile.gateway_web_ui,
        "expiryDate": profile.expiry_date,
        "modelConfigSnapshot": profile.model_config_snapshot,
        "approvalRules": profile.approval_rules,
        "_note": "apiKey 出于安全原因未导出"
    });

    let json = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}
