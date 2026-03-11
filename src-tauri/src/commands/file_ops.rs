use crate::core::error::AppError;
use std::path::Path;

#[tauri::command]
pub async fn copy_file(src: String, dest: String) -> Result<(), AppError> {
    let src_path = Path::new(&src);
    if !src_path.exists() {
        return Err(AppError::NotFound { path: src });
    }

    // Create parent directory if it doesn't exist
    if let Some(parent) = Path::new(&dest).parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::IoError {
            message: e.to_string(),
            path: Some(dest.clone()),
        })?;
    }

    std::fs::copy(&src, &dest).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(dest),
    })?;

    Ok(())
}

#[tauri::command]
pub async fn check_is_text_file(path: String) -> Result<bool, AppError> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::NotFound { path });
    }

    let bytes = std::fs::read(file_path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(path),
    })?;

    let check_size = 8192.min(bytes.len());
    Ok(crate::utils::encoding::is_text_file(&bytes[..check_size]))
}
