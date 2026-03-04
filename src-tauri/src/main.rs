// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth_client;
mod config;
mod tray;
mod ws_client;

use tauri::Manager;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::save_config,
            auth_client::check_auth,
            ws_client::connect_gateway,
            ws_client::disconnect_gateway,
            open_cloud_console,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
