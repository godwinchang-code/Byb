use std::path::Path;

use crate::core::bin_diff;
use crate::core::error::AppError;
use crate::core::types::BinDiffResult;

#[tauri::command]
pub async fn compare_binary_files(left: String, right: String) -> Result<BinDiffResult, AppError> {
    let left_path = left.clone();
    let right_path = right.clone();

    tokio::task::spawn_blocking(move || {
        bin_diff::compare_binary(Path::new(&left_path), Path::new(&right_path))
    })
    .await
    .map_err(|e| AppError::IoError {
        message: format!("Task join error: {e}"),
        path: None,
    })?
}

#[tauri::command]
pub async fn read_binary_chunk(
    path: String,
    offset: u64,
    length: u32,
) -> Result<Vec<u8>, AppError> {
    let p = path.clone();
    tokio::task::spawn_blocking(move || {
        bin_diff::read_chunk(Path::new(&p), offset, length as usize)
    })
    .await
    .map_err(|e| AppError::IoError {
        message: format!("Task join error: {e}"),
        path: None,
    })?
}
