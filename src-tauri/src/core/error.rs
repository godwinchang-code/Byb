use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("I/O error: {message}")]
    IoError {
        message: String,
        path: Option<String>,
    },

    #[error("Encoding error: {message}")]
    EncodingError {
        message: String,
        path: Option<String>,
    },

    #[error("File too large: {path} ({size} bytes exceeds {limit} byte limit)")]
    FileTooLarge { path: String, size: u64, limit: u64 },

    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },

    #[error("Not found: {path}")]
    NotFound { path: String },

    #[error("Operation cancelled")]
    Cancelled,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;

        let (code, message, path) = match self {
            AppError::IoError { message, path } => ("IO_ERROR", message.clone(), path.clone()),
            AppError::EncodingError { message, path } => {
                ("ENCODING_ERROR", message.clone(), path.clone())
            }
            AppError::FileTooLarge { path, size, limit } => (
                "FILE_TOO_LARGE",
                format!("{size} bytes exceeds {limit} byte limit"),
                Some(path.clone()),
            ),
            AppError::PermissionDenied { path } => {
                ("PERMISSION_DENIED", format!("Permission denied: {path}"), Some(path.clone()))
            }
            AppError::NotFound { path } => {
                ("NOT_FOUND", format!("Not found: {path}"), Some(path.clone()))
            }
            AppError::Cancelled => ("CANCELLED", "Operation cancelled".to_string(), None),
        };

        let mut state = serializer.serialize_struct("AppError", 3)?;
        state.serialize_field("code", code)?;
        state.serialize_field("message", &message)?;
        state.serialize_field("path", &path)?;
        state.end()
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound {
                path: String::new(),
            },
            std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied {
                path: String::new(),
            },
            _ => AppError::IoError {
                message: err.to_string(),
                path: None,
            },
        }
    }
}
