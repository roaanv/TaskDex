//! commands.rs — the Tauri command surface. Each command locks the SQLite
//! connection and delegates to `ops` (which holds the transactional logic).
//! Argument names are camelCase on the JS side; Tauri maps them to snake_case.

use serde_json::Value;
use tauri::State;

use crate::db::{load_snapshot, Db};
use crate::model::{Card, Snapshot};
use crate::ops;

type CmdResult<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// === read path + theme ======================================================

#[tauri::command]
pub fn get_snapshot(db: State<Db>) -> CmdResult<Snapshot> {
    let conn = db.0.lock().map_err(err)?;
    load_snapshot(&conn).map_err(err)
}

#[tauri::command]
pub fn get_theme_pref(db: State<Db>) -> CmdResult<String> {
    let conn = db.0.lock().map_err(err)?;
    ops::get_theme_pref(&conn).map_err(err)
}

#[tauri::command]
pub fn set_theme_pref(db: State<Db>, pref: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::set_theme_pref(&conn, &pref).map_err(err)
}

// === cards ==================================================================

#[tauri::command]
pub fn add_card(db: State<Db>, card: Card) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::add_card(&mut conn, &card).map_err(err)
}

#[tauri::command]
pub fn update_card(db: State<Db>, id: String, patch: Value) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::update_card(&conn, &id, &patch).map_err(err)
}

#[tauri::command]
pub fn delete_card(db: State<Db>, id: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::delete_card(&conn, &id).map_err(err)
}

#[tauri::command]
pub fn set_prop(
    db: State<Db>,
    id: String,
    name: String,
    value: String,
    prop_type: String,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::set_prop(&conn, &id, &name, &value, &prop_type).map_err(err)
}

#[tauri::command]
pub fn rename_prop(db: State<Db>, id: String, from: String, to: String) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::rename_prop(&mut conn, &id, &from, &to).map_err(err)
}

#[tauri::command]
pub fn remove_prop(db: State<Db>, id: String, name: String) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::remove_prop(&mut conn, &id, &name).map_err(err)
}

#[tauri::command]
pub fn toggle_promote(
    db: State<Db>,
    id: String,
    name: String,
    front: bool,
    title: bool,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::toggle_promote(&conn, &id, &name, front, title).map_err(err)
}

#[tauri::command]
pub fn move_to_column(db: State<Db>, id: String, board_id: String, value: String) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::move_to_column(&conn, &id, &board_id, &value).map_err(err)
}

#[tauri::command]
pub fn reorder_cards(db: State<Db>, order: Vec<String>) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::reorder_cards(&mut conn, &order).map_err(err)
}

#[tauri::command]
pub fn set_collapsed(
    db: State<Db>,
    board_id: String,
    card_id: String,
    value: bool,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::set_collapsed(&conn, &board_id, &card_id, value).map_err(err)
}

// === boards =================================================================

#[tauri::command]
pub fn set_active(db: State<Db>, id: Option<String>) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::set_active(&conn, id.as_deref()).map_err(err)
}

#[tauri::command]
pub fn add_board(db: State<Db>, id: String, name: String, color: String) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::add_board(&mut conn, &id, &name, &color).map_err(err)
}

#[tauri::command]
pub fn remove_board(db: State<Db>, id: String) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::remove_board(&mut conn, &id).map_err(err)
}

#[tauri::command]
pub fn reorder_boards(db: State<Db>, order: Vec<String>) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::reorder_boards(&mut conn, &order).map_err(err)
}

#[tauri::command]
pub fn update_board(db: State<Db>, id: String, patch: Value) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::update_board(&mut conn, &id, &patch).map_err(err)
}

#[tauri::command]
pub fn set_column_config(
    db: State<Db>,
    board_id: String,
    property: String,
    value: String,
    patch: Value,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::set_column_config(&conn, &board_id, &property, &value, &patch).map_err(err)
}

#[tauri::command]
pub fn add_column(
    db: State<Db>,
    board_id: String,
    property: String,
    value: String,
    color: String,
    order: i64,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::add_column(&conn, &board_id, &property, &value, &color, order).map_err(err)
}

#[tauri::command]
pub fn reorder_column(
    db: State<Db>,
    board_id: String,
    property: String,
    value: String,
    dir: String,
) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::reorder_column(&mut conn, &board_id, &property, &value, &dir).map_err(err)
}

#[tauri::command]
pub fn reorder_columns(
    db: State<Db>,
    board_id: String,
    property: String,
    order: Vec<String>,
) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::reorder_columns(&mut conn, &board_id, &property, &order).map_err(err)
}

#[tauri::command]
pub fn rename_column(
    db: State<Db>,
    prop: String,
    from: String,
    to: String,
) -> CmdResult<()> {
    let mut conn = db.0.lock().map_err(err)?;
    ops::rename_column(&mut conn, &prop, &from, &to).map_err(err)
}

#[tauri::command]
pub fn remove_column(
    db: State<Db>,
    board_id: String,
    property: String,
    value: String,
) -> CmdResult<()> {
    let conn = db.0.lock().map_err(err)?;
    ops::remove_column(&conn, &board_id, &property, &value).map_err(err)
}
