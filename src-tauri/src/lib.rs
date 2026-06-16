//! lib.rs — TaskDex Tauri application entry point.
//! Opens the SQLite database in the OS app-data dir, runs migrations, seeds on
//! first run, and registers the command surface.

mod commands;
mod db;
mod model;

use std::sync::Mutex;

use tauri::Manager;

use db::Db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
            let db_path = data_dir.join("taskdex.db");

            let mut conn = db::open(&db_path).expect("failed to open database");
            db::ensure_seeded(&mut conn).expect("failed to seed database");

            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_snapshot,
            commands::get_theme_pref,
            commands::set_theme_pref,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
