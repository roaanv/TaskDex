//! commands.rs — Tauri command surface. Each mutation runs in its own SQLite
//! transaction; `get_snapshot` reads the full persisted state on launch.
//!
//! Slice 1 exposes the read path (`get_snapshot`) plus theme preference I/O.
//! Mutation commands (mirroring the reducer actions) are added in later slices.

use rusqlite::params;
use tauri::State;

use crate::db::{load_snapshot, Db};
use crate::model::Snapshot;

type CmdResult<T> = Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
pub fn get_snapshot(db: State<Db>) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(map_err)?;
    load_snapshot(&conn).map_err(map_err)
}

#[tauri::command]
pub fn get_theme_pref(db: State<Db>) -> CmdResult<String> {
    let conn = db.0.lock().map_err(map_err)?;
    let pref: Option<String> = conn
        .query_row("SELECT value FROM app_meta WHERE key='theme_pref'", [], |r| {
            r.get(0)
        })
        .ok();
    Ok(pref.unwrap_or_else(|| "dark".to_string()))
}

#[tauri::command]
pub fn set_theme_pref(db: State<Db>, pref: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(map_err)?;
    conn.execute(
        "INSERT INTO app_meta (key, value) VALUES ('theme_pref', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![pref],
    )
    .map_err(map_err)?;
    Ok(())
}
