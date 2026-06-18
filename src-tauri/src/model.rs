//! model.rs — serde structs mirroring the TaskDex data model 1:1 with the
//! frontend TypeScript types (ported from the prototype's `store.jsx`).
//!
//! The SQLite `cards` table stores `title` and `notes` in separate columns, but
//! the frontend model uses a single `body` string (line 0 = title, the rest =
//! notes). Reconstruction happens in `db.rs` when building these structs.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

/// A typed property value. `value` is always stored as a string.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Prop {
    #[serde(rename = "type")]
    pub ptype: String,
    pub value: String,
}

/// Which surfaces a promoted property chip appears on.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Promotion {
    #[serde(default)]
    pub front: bool,
    #[serde(default)]
    pub title: bool,
}

/// A card. `props`/`promotions` preserve insertion order (rowid order in SQLite).
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Card {
    pub id: String,
    pub body: String,
    pub props: IndexMap<String, Prop>,
    pub promotions: IndexMap<String, Promotion>,
    pub created: i64,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub ord: Option<i64>,
}

/// A filter rule. `value` is a string, or a `[min, max]` array for the `between` op.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Rule {
    pub id: String,
    pub prop: String,
    pub op: String,
    pub value: serde_json::Value,
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Filter {
    pub connector: String,
    pub rules: Vec<Rule>,
    /// Whether the filter is active. When `false`, the rules are kept but
    /// ignored so the board shows every card. Defaults to `true` for filters
    /// persisted before this field existed (mirrors the TS `Filter.enabled?`).
    #[serde(default = "default_true")]
    pub enabled: bool,
}

/// One column within a property's ordered list (`Board.columns_by_property`).
/// Position is the array index; `value` is the group value AND the join key to
/// `card_props.value`.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Column {
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub hidden: Option<bool>,
}

/// A board (a saved view over the global card pool).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    pub id: String,
    pub name: String,
    pub color: String,
    pub group_by: Option<String>,
    pub filter: Filter,
    pub filter_open: bool,
    /// property name -> ordered columns. Serializes as `columnsByProperty`.
    pub columns_by_property: IndexMap<String, Vec<Column>>,
    pub collapsed: IndexMap<String, bool>,
}

/// The full snapshot returned by `get_snapshot` and persisted to SQLite.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub cards: IndexMap<String, Card>,
    pub boards: Vec<Board>,
    pub active_board_id: Option<String>,
}

/// Split a `body` string into its (title, notes) columns for storage.
pub fn split_body(body: &str) -> (String, String) {
    let mut lines = body.splitn(2, '\n');
    let title = lines.next().unwrap_or("").to_string();
    let notes = lines.next().unwrap_or("").to_string();
    (title, notes)
}

/// Reconstruct a `body` string from the stored title/notes columns.
pub fn join_body(title: &str, notes: &str) -> String {
    format!("{title}\n{notes}")
}
