/// Check if byte content is valid UTF-8.
pub fn is_utf8(data: &[u8]) -> bool {
    std::str::from_utf8(data).is_ok()
}

/// Detect if a file is likely text (UTF-8) by reading its first bytes.
/// Returns true if the content appears to be valid UTF-8 text.
pub fn is_text_file(data: &[u8]) -> bool {
    // Empty files are considered text
    if data.is_empty() {
        return true;
    }

    // Check for null bytes (strong binary indicator)
    if data.contains(&0) {
        return false;
    }

    is_utf8(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_is_text() {
        assert!(is_text_file(b""));
    }

    #[test]
    fn test_ascii_is_text() {
        assert!(is_text_file(b"Hello, world!\n"));
    }

    #[test]
    fn test_utf8_is_text() {
        assert!(is_text_file("你好世界".as_bytes()));
    }

    #[test]
    fn test_null_bytes_is_binary() {
        assert!(!is_text_file(b"hello\x00world"));
    }

    #[test]
    fn test_invalid_utf8_is_binary() {
        assert!(!is_text_file(&[0xff, 0xfe, 0x80, 0x81]));
    }
}
