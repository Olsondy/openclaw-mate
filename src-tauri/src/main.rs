// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth_client;
mod config;
mod device_identity;
mod tray;
mod ws_client;

use tauri::Manager;

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}

#[tauri::command]
async fn open_cloud_console(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    let existing = app.get_webview_window("cloud-console");
    if let Some(win) = existing {
        win.show().map_err(|e: tauri::Error| e.to_string())?;
        win.set_focus().map_err(|e: tauri::Error| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "cloud-console",
        tauri::WebviewUrl::External(
            url.parse()
                .map_err(|e: url::ParseError| e.to_string())?,
        ),
    )
    .title("OpenClaw Cloud Console")
    .inner_size(1200.0, 800.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取（或生成）当前设备的 ed25519 身份信息，供前端在 verify 和 connect 时使用
#[tauri::command]
fn get_device_identity(app: tauri::AppHandle) -> Result<device_identity::DeviceIdentity, String> {
    device_identity::load_or_create_device_identity(&app)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            tray::setup_tray(app)?;
            // 启动时预先生成（或加载）设备身份，确保 config.json 中始终有密钥对
            if let Err(e) = device_identity::load_or_create_device_identity(app.handle()) {
                eprintln!("[device_identity] 初始化失败: {}", e);
            }
            // 后台静默检查更新
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_updater::UpdaterExt;
                match handle.updater() {
                    Ok(updater) => match updater.check().await {
                        Ok(Some(update)) => {
                            handle.emit("update:available", &update.version).ok();
                        }
                        Ok(None) => {}
                        Err(e) => eprintln!("[updater] 检查更新失败: {}", e),
                    },
                    Err(e) => eprintln!("[updater] 初始化失败: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::save_config,
            auth_client::check_auth,
            ws_client::connect_gateway,
            ws_client::disconnect_gateway,
            get_device_identity,
            open_cloud_console,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
