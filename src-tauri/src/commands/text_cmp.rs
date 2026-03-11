use crate::core::error::AppError;
use crate::core::text_diff::compute_text_diff;
use crate::core::types::TextDiffResult;
use crate::utils::encoding::is_text_file;
use std::path::Path;

const MAX_TEXT_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50 MB

#[tauri::command]
pub async fn compare_text_files(left: String, right: String) -> Result<TextDiffResult, AppError> {
    let left_path = Path::new(&left);
    let right_path = Path::new(&right);

    // Validate paths exist
    if !left_path.exists() {
        return Err(AppError::NotFound { path: left.clone() });
    }
    if !right_path.exists() {
        return Err(AppError::NotFound {
            path: right.clone(),
        });
    }

    // Check file sizes
    let left_size = std::fs::metadata(left_path)
        .map_err(|e| AppError::IoError {
            message: e.to_string(),
            path: Some(left.clone()),
        })?
        .len();
    let right_size = std::fs::metadata(right_path)
        .map_err(|e| AppError::IoError {
            message: e.to_string(),
            path: Some(right.clone()),
        })?
        .len();

    if left_size > MAX_TEXT_FILE_SIZE {
        return Err(AppError::FileTooLarge {
            path: left,
            size: left_size,
            limit: MAX_TEXT_FILE_SIZE,
        });
    }
    if right_size > MAX_TEXT_FILE_SIZE {
        return Err(AppError::FileTooLarge {
            path: right,
            size: right_size,
            limit: MAX_TEXT_FILE_SIZE,
        });
    }

    // Read files
    let left_bytes = std::fs::read(left_path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(left.clone()),
    })?;
    let right_bytes = std::fs::read(right_path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(right.clone()),
    })?;

    // Check if files are text
    let check_size = 8192.min(left_bytes.len());
    if !is_text_file(&left_bytes[..check_size]) {
        return Err(AppError::EncodingError {
            message: "File does not appear to be UTF-8 text".to_string(),
            path: Some(left),
        });
    }
    let check_size = 8192.min(right_bytes.len());
    if !is_text_file(&right_bytes[..check_size]) {
        return Err(AppError::EncodingError {
            message: "File does not appear to be UTF-8 text".to_string(),
            path: Some(right),
        });
    }

    // Decode as UTF-8
    let left_text = String::from_utf8(left_bytes).map_err(|e| AppError::EncodingError {
        message: e.to_string(),
        path: Some(left),
    })?;
    let right_text = String::from_utf8(right_bytes).map_err(|e| AppError::EncodingError {
        message: e.to_string(),
        path: Some(right),
    })?;

    // Compute diff on a blocking thread to avoid blocking the async runtime
    let result =
        tokio::task::spawn_blocking(move || compute_text_diff(&left_text, &right_text))
            .await
            .map_err(|e| AppError::IoError {
                message: format!("Diff computation failed: {}", e),
                path: None,
            })?;

    Ok(result)
}

#[tauri::command]
pub async fn compare_text_contents(
    left_content: String,
    right_content: String,
) -> Result<TextDiffResult, AppError> {
    let result =
        tokio::task::spawn_blocking(move || compute_text_diff(&left_content, &right_content))
            .await
            .map_err(|e| AppError::IoError {
                message: format!("Diff computation failed: {}", e),
                path: None,
            })?;

    Ok(result)
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, AppError> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(AppError::NotFound { path });
    }

    let content = std::fs::read_to_string(file_path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(path),
    })?;

    Ok(content)
}

#[tauri::command]
pub async fn save_text_file(path: String, content: String) -> Result<(), AppError> {
    std::fs::write(&path, &content).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(path),
    })?;
    Ok(())
}
