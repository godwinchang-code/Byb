pub mod bin_cmp;
pub mod dir_cmp;
pub mod file_ops;
pub mod session;
pub mod text_cmp;

/// Temporary greet command for scaffold verification.
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to byb.", name)
}
