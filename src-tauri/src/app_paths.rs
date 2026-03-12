use std::fs;
use std::path::PathBuf;

const APP_DIR_NAME: &str = ".clatemate";
const LEGACY_APP_DIR_NAME: &str = "clawmate";

pub fn app_root_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "无法获取用户主目录".to_string())?;
    let target_dir = home.join(APP_DIR_NAME);
    let legacy_dir = home.join(LEGACY_APP_DIR_NAME);

    // 兼容迁移：新目录不存在且旧目录存在时，尝试迁移旧目录
    if !target_dir.exists() && legacy_dir.exists() {
        if let Err(err) = fs::rename(&legacy_dir, &target_dir) {
            eprintln!(
                "[paths] 迁移目录失败 ({} -> {}): {}",
                legacy_dir.display(),
                target_dir.display(),
                err
            );
        }
    }

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("创建 {} 目录失败: {}", APP_DIR_NAME, e))?;
    Ok(target_dir)
}

pub fn app_profiles_dir() -> Result<PathBuf, String> {
    let dir = app_root_dir()?.join("profiles");
    fs::create_dir_all(&dir).map_err(|e| format!("创建 profiles 目录失败: {}", e))?;
    Ok(dir)
}

pub fn app_exports_dir() -> Result<PathBuf, String> {
    let dir = app_root_dir()?.join("exports");
    fs::create_dir_all(&dir).map_err(|e| format!("创建 exports 目录失败: {}", e))?;
    Ok(dir)
}

pub fn app_logs_dir() -> Result<PathBuf, String> {
    let dir = app_root_dir()?.join("logs");
    fs::create_dir_all(&dir).map_err(|e| format!("创建 logs 目录失败: {}", e))?;
    Ok(dir)
}
