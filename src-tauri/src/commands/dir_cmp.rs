use crate::core::dir_diff::compare_directories;
use crate::core::error::AppError;
use crate::core::types::{DirCmpOptions, DirNode};
use std::path::Path;

#[tauri::command]
pub async fn compare_dirs(
    left: String,
    right: String,
    options: DirCmpOptions,
) -> Result<DirNode, AppError> {
    let left_path = Path::new(&left);
    let right_path = Path::new(&right);

    if !left_path.exists() {
        return Err(AppError::NotFound { path: left });
    }
    if !right_path.exists() {
        return Err(AppError::NotFound { path: right });
    }
    if !left_path.is_dir() {
        return Err(AppError::IoError {
            message: "Path is not a directory".to_string(),
            path: Some(left),
        });
    }
    if !right_path.is_dir() {
        return Err(AppError::IoError {
            message: "Path is not a directory".to_string(),
            path: Some(right),
        });
    }

    let left_owned = left.clone();
    let right_owned = right.clone();
    let opts = options.clone();

    let result = tokio::task::spawn_blocking(move || {
        compare_directories(Path::new(&left_owned), Path::new(&right_owned), &opts)
    })
    .await
    .map_err(|e| AppError::IoError {
        message: format!("Directory comparison failed: {}", e),
        path: None,
    })?;

    Ok(result)
}
