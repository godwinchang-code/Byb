use crate::core::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSession {
    pub left: String,
    pub right: String,
    #[serde(rename = "type")]
    pub session_type: String, // "directory" | "file"
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionData {
    pub recent_sessions: Vec<RecentSession>,
}

fn session_file_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| AppError::IoError {
            message: "Could not resolve app data directory".into(),
            path: None,
        })?;
    fs::create_dir_all(&app_dir).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(app_dir.display().to_string()),
    })?;
    Ok(app_dir.join("session.json"))
}

#[tauri::command]
pub async fn load_session(app_handle: tauri::AppHandle) -> Result<SessionData, AppError> {
    let path = session_file_path(&app_handle)?;
    if !path.exists() {
        return Ok(SessionData::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(path.display().to_string()),
    })?;
    let data: SessionData = serde_json::from_str(&content).unwrap_or_default();
    Ok(data)
}

#[tauri::command]
pub async fn save_session(
    app_handle: tauri::AppHandle,
    data: SessionData,
) -> Result<(), AppError> {
    let path = session_file_path(&app_handle)?;
    let content = serde_json::to_string_pretty(&data).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: None,
    })?;
    fs::write(&path, content).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(path.display().to_string()),
    })?;
    Ok(())
}
