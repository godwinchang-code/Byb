use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use crate::core::error::AppError;
use crate::core::types::{BinDiffResult, ByteRange};

const CHUNK_SIZE: usize = 64 * 1024; // 64 KB

/// Compare two binary files and return byte ranges where they differ.
pub fn compare_binary(left_path: &Path, right_path: &Path) -> Result<BinDiffResult, AppError> {
    let mut left_file = File::open(left_path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(left_path.display().to_string()),
    })?;
    let mut right_file = File::open(right_path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(right_path.display().to_string()),
    })?;

    let total_size_left = left_file.metadata().map(|m| m.len()).unwrap_or(0);
    let total_size_right = right_file.metadata().map(|m| m.len()).unwrap_or(0);

    let mut diff_ranges: Vec<ByteRange> = Vec::new();
    let mut left_buf = vec![0u8; CHUNK_SIZE];
    let mut right_buf = vec![0u8; CHUNK_SIZE];
    let mut offset: u64 = 0;

    // Current open diff range being built
    let mut diff_start: Option<u64> = None;

    loop {
        let left_read = read_exact_or_eof(&mut left_file, &mut left_buf)?;
        let right_read = read_exact_or_eof(&mut right_file, &mut right_buf)?;

        if left_read == 0 && right_read == 0 {
            break;
        }

        let common_len = left_read.min(right_read);

        // Compare common bytes
        for i in 0..common_len {
            if left_buf[i] != right_buf[i] {
                if diff_start.is_none() {
                    diff_start = Some(offset + i as u64);
                }
            } else if let Some(start) = diff_start {
                diff_ranges.push(ByteRange {
                    offset: start,
                    length: offset + i as u64 - start,
                });
                diff_start = None;
            }
        }

        // Handle tail (one file is longer)
        if left_read != right_read {
            let tail_start = offset + common_len as u64;
            let tail_end = offset + left_read.max(right_read) as u64;
            if let Some(start) = diff_start {
                // Extend existing diff to cover tail
                diff_ranges.push(ByteRange {
                    offset: start,
                    length: tail_end - start,
                });
                diff_start = None;
            } else {
                diff_ranges.push(ByteRange {
                    offset: tail_start,
                    length: tail_end - tail_start,
                });
            }
        }

        offset += left_read.max(right_read) as u64;

        // If both reached EOF, stop
        if left_read < CHUNK_SIZE && right_read < CHUNK_SIZE {
            break;
        }
    }

    // Close any remaining open diff
    if let Some(start) = diff_start {
        diff_ranges.push(ByteRange {
            offset: start,
            length: offset - start,
        });
    }

    Ok(BinDiffResult {
        diff_ranges,
        total_size_left,
        total_size_right,
    })
}

/// Read a chunk of bytes from a file at the given offset.
pub fn read_chunk(path: &Path, offset: u64, length: usize) -> Result<Vec<u8>, AppError> {
    let max_chunk = 1024 * 1024; // 1 MB limit per call
    let length = length.min(max_chunk);

    let mut file = File::open(path).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(path.display().to_string()),
    })?;

    file.seek(SeekFrom::Start(offset)).map_err(|e| AppError::IoError {
        message: e.to_string(),
        path: Some(path.display().to_string()),
    })?;

    let mut buf = vec![0u8; length];
    let n = read_exact_or_eof(&mut file, &mut buf)?;
    buf.truncate(n);
    Ok(buf)
}

fn read_exact_or_eof(reader: &mut impl Read, buf: &mut [u8]) -> Result<usize, AppError> {
    let mut total = 0;
    while total < buf.len() {
        match reader.read(&mut buf[total..]) {
            Ok(0) => break,
            Ok(n) => total += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => {
                return Err(AppError::IoError {
                    message: e.to_string(),
                    path: None,
                })
            }
        }
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_temp(data: &[u8]) -> NamedTempFile {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(data).unwrap();
        f.flush().unwrap();
        f
    }

    #[test]
    fn identical_files() {
        let left = write_temp(b"hello world");
        let right = write_temp(b"hello world");
        let result = compare_binary(left.path(), right.path()).unwrap();
        assert!(result.diff_ranges.is_empty());
        assert_eq!(result.total_size_left, 11);
        assert_eq!(result.total_size_right, 11);
    }

    #[test]
    fn completely_different() {
        let left = write_temp(b"aaaa");
        let right = write_temp(b"bbbb");
        let result = compare_binary(left.path(), right.path()).unwrap();
        assert_eq!(result.diff_ranges.len(), 1);
        assert_eq!(result.diff_ranges[0].offset, 0);
        assert_eq!(result.diff_ranges[0].length, 4);
    }

    #[test]
    fn different_sizes() {
        let left = write_temp(b"abc");
        let right = write_temp(b"abcdef");
        let result = compare_binary(left.path(), right.path()).unwrap();
        assert_eq!(result.diff_ranges.len(), 1);
        assert_eq!(result.diff_ranges[0].offset, 3);
        assert_eq!(result.diff_ranges[0].length, 3);
    }

    #[test]
    fn empty_files() {
        let left = write_temp(b"");
        let right = write_temp(b"");
        let result = compare_binary(left.path(), right.path()).unwrap();
        assert!(result.diff_ranges.is_empty());
    }

    #[test]
    fn one_empty() {
        let left = write_temp(b"");
        let right = write_temp(b"data");
        let result = compare_binary(left.path(), right.path()).unwrap();
        assert_eq!(result.diff_ranges.len(), 1);
        assert_eq!(result.diff_ranges[0].offset, 0);
        assert_eq!(result.diff_ranges[0].length, 4);
    }

    #[test]
    fn middle_diff() {
        let left = write_temp(b"abcXXXghi");
        let right = write_temp(b"abcYYYghi");
        let result = compare_binary(left.path(), right.path()).unwrap();
        assert_eq!(result.diff_ranges.len(), 1);
        assert_eq!(result.diff_ranges[0].offset, 3);
        assert_eq!(result.diff_ranges[0].length, 3);
    }

    #[test]
    fn read_chunk_works() {
        let f = write_temp(b"0123456789abcdef");
        let chunk = read_chunk(f.path(), 4, 8).unwrap();
        assert_eq!(chunk, b"456789ab");
    }
}
