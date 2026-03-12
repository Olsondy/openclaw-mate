use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const LOG_PREFIX: &str = "activity-";
const LOG_SUFFIX: &str = ".jsonl";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredActivityLog {
    pub bucket: String,
    pub id: String,
    pub timestamp: String,
    #[serde(alias = "taskId")]
    pub task_id: String,
    pub source: String,
    pub level: String,
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
    #[serde(alias = "taskType")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_type: Option<String>,
    #[serde(alias = "durationMs")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

fn validate_day_key(day_key: &str) -> Result<(), String> {
    let bytes = day_key.as_bytes();
    if bytes.len() != 10 {
        return Err("dayKey 格式非法，应为 YYYY-MM-DD".to_string());
    }
    for (idx, ch) in bytes.iter().enumerate() {
        let is_dash_pos = idx == 4 || idx == 7;
        if is_dash_pos && *ch != b'-' {
            return Err("dayKey 格式非法，应为 YYYY-MM-DD".to_string());
        }
        if !is_dash_pos && !ch.is_ascii_digit() {
            return Err("dayKey 格式非法，应为 YYYY-MM-DD".to_string());
        }
    }
    Ok(())
}

fn today_log_path(day_key: &str) -> Result<PathBuf, String> {
    validate_day_key(day_key)?;
    Ok(crate::app_paths::app_logs_dir()?.join(format!("{}{}{}", LOG_PREFIX, day_key, LOG_SUFFIX)))
}

fn is_activity_log_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
        return false;
    };
    name.starts_with(LOG_PREFIX) && name.ends_with(LOG_SUFFIX)
}

fn cleanup_old_logs(logs_dir: &Path, keep: Option<&Path>) -> Result<(), String> {
    if !logs_dir.exists() {
        return Ok(());
    }

    let keep_path = keep.map(|p| p.to_path_buf());
    for entry in fs::read_dir(logs_dir).map_err(|e| format!("读取日志目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取日志目录项失败: {}", e))?;
        let path = entry.path();
        if !is_activity_log_file(&path) {
            continue;
        }
        if let Some(ref keep_file) = keep_path {
            if &path == keep_file {
                continue;
            }
        }
        if let Err(err) = fs::remove_file(&path) {
            eprintln!(
                "[activity_log_store] 删除旧日志文件失败 {}: {}",
                path.display(),
                err
            );
        }
    }
    Ok(())
}

#[tauri::command]
pub fn append_activity_log(day_key: String, entry: StoredActivityLog) -> Result<(), String> {
    let log_path = today_log_path(&day_key)?;
    let logs_dir = crate::app_paths::app_logs_dir()?;
    cleanup_old_logs(&logs_dir, Some(&log_path))?;

    let line = serde_json::to_string(&entry).map_err(|e| format!("序列化日志失败: {}", e))?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("写入日志文件失败: {}", e))?;
    file.write_all(format!("{}\n", line).as_bytes())
        .map_err(|e| format!("写入日志内容失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn load_activity_logs(day_key: String) -> Result<Vec<StoredActivityLog>, String> {
    let log_path = today_log_path(&day_key)?;
    let logs_dir = crate::app_paths::app_logs_dir()?;
    cleanup_old_logs(&logs_dir, Some(&log_path))?;

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&log_path).map_err(|e| format!("读取日志文件失败: {}", e))?;
    let reader = BufReader::new(file);
    let mut entries: Vec<StoredActivityLog> = Vec::new();
    for line in reader.lines() {
        let line = match line {
            Ok(content) => content,
            Err(_) => continue,
        };
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(item) = serde_json::from_str::<StoredActivityLog>(&line) {
            entries.push(item);
        }
    }
    Ok(entries)
}

#[tauri::command]
pub fn clear_activity_logs() -> Result<(), String> {
    let logs_dir = crate::app_paths::app_logs_dir()?;
    cleanup_old_logs(&logs_dir, None)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::StoredActivityLog;

    #[test]
    fn deserialize_supports_snake_case_fields() {
        let raw = r#"{
            "bucket":"client",
            "id":"log-1",
            "timestamp":"2026-03-12T11:00:00.000Z",
            "task_id":"task-1",
            "source":"mate",
            "level":"info",
            "title":"title",
            "description":"desc",
            "tags":["a","b"],
            "task_type":"notify",
            "duration_ms":12
        }"#;

        let parsed: StoredActivityLog =
            serde_json::from_str(raw).expect("snake_case payload should deserialize");
        assert_eq!(parsed.task_id, "task-1");
        assert_eq!(parsed.task_type.as_deref(), Some("notify"));
        assert_eq!(parsed.duration_ms, Some(12));
    }

    #[test]
    fn deserialize_supports_camel_case_fields() {
        let raw = r#"{
            "bucket":"client",
            "id":"log-1",
            "timestamp":"2026-03-12T11:00:00.000Z",
            "taskId":"task-1",
            "source":"mate",
            "level":"info",
            "title":"title",
            "description":"desc",
            "tags":["a","b"],
            "taskType":"notify",
            "durationMs":12
        }"#;

        let parsed: StoredActivityLog =
            serde_json::from_str(raw).expect("camelCase payload should deserialize");
        assert_eq!(parsed.task_id, "task-1");
        assert_eq!(parsed.task_type.as_deref(), Some("notify"));
        assert_eq!(parsed.duration_ms, Some(12));
    }
}
