mod commands;
mod core;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::text_cmp::compare_text_files,
            commands::text_cmp::compare_text_contents,
            commands::text_cmp::read_text_file,
            commands::text_cmp::save_text_file,
            commands::file_ops::copy_file,
            commands::file_ops::check_is_text_file,
            commands::dir_cmp::compare_dirs,
            commands::bin_cmp::compare_binary_files,
            commands::bin_cmp::read_binary_chunk,
            commands::session::load_session,
            commands::session::save_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
