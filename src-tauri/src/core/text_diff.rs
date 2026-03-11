use imara_diff::intern::{InternedInput, Interner, Token};
use imara_diff::{diff, Algorithm};
use std::ops::Range;

use super::types::{ChangeKind, CharSpan, DiffHunk, LineChange, Side, TextDiffResult};

/// Compute a two-pass text diff: line-level first, then character-level refinement
/// for modified lines.
pub fn compute_text_diff(left_text: &str, right_text: &str) -> TextDiffResult {
    let left_lines: Vec<&str> = split_lines(left_text);
    let right_lines: Vec<&str> = split_lines(right_text);

    let input = InternedInput::new(left_text, right_text);

    // Collect raw changes from imara-diff
    let mut raw_changes: Vec<(Range<u32>, Range<u32>)> = Vec::new();
    diff(
        Algorithm::Histogram,
        &input,
        |before: Range<u32>, after: Range<u32>| {
            raw_changes.push((before, after));
        },
    );

    // Build hunks from raw changes
    let hunks = build_hunks(&raw_changes, &left_lines, &right_lines);

    TextDiffResult {
        hunks,
        left_line_count: left_lines.len(),
        right_line_count: right_lines.len(),
        left_encoding: "utf-8".to_string(),
        right_encoding: "utf-8".to_string(),
    }
}

/// Split text into lines, preserving empty lines but stripping line terminators.
fn split_lines(text: &str) -> Vec<&str> {
    if text.is_empty() {
        return Vec::new();
    }
    let mut lines: Vec<&str> = text.lines().collect();
    // If text ends with a newline, text.lines() doesn't produce a trailing empty string,
    // but we don't need to add one because the newline is a terminator, not a separator.
    // However, if text ends with \n\n, the last empty line IS included by lines().
    // Actually, Rust's lines() strips trailing empty lines. Let's handle this correctly:
    if text.ends_with('\n') || text.ends_with("\r\n") {
        // lines() omits the final empty element after trailing newline
        // We add it back for accurate line counting
        lines.push("");
    }
    lines
}

/// Build diff hunks from raw change ranges, including context for grouping.
fn build_hunks(
    raw_changes: &[(Range<u32>, Range<u32>)],
    left_lines: &[&str],
    right_lines: &[&str],
) -> Vec<DiffHunk> {
    if raw_changes.is_empty() {
        return Vec::new();
    }

    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut left_pos: usize = 0;
    let mut right_pos: usize = 0;

    for (before, after) in raw_changes {
        let del_start = before.start as usize;
        let del_end = before.end as usize;
        let ins_start = after.start as usize;
        let ins_end = after.end as usize;

        // Equal lines before this change
        // The number of equal lines between left_pos..del_start and right_pos..ins_start
        // should be the same (that's the invariant of the diff algorithm)

        // Build the change for this hunk
        let del_lines = &left_lines[del_start..del_end];
        let ins_lines = &right_lines[ins_start..ins_end];

        let mut changes = Vec::new();

        if !del_lines.is_empty() && !ins_lines.is_empty() {
            // This is a modify: some lines deleted, some inserted
            // Pair them up for character-level diff
            let min_len = del_lines.len().min(ins_lines.len());

            // Paired modifications
            for i in 0..min_len {
                let char_diffs = compute_char_diff(del_lines[i], ins_lines[i]);
                changes.push(LineChange {
                    kind: ChangeKind::Modify,
                    left_line: Some(del_lines[i].to_string()),
                    right_line: Some(ins_lines[i].to_string()),
                    char_diffs: Some(char_diffs),
                });
            }

            // Remaining deletions
            for line in &del_lines[min_len..] {
                changes.push(LineChange {
                    kind: ChangeKind::Delete,
                    left_line: Some(line.to_string()),
                    right_line: None,
                    char_diffs: None,
                });
            }

            // Remaining insertions
            for line in &ins_lines[min_len..] {
                changes.push(LineChange {
                    kind: ChangeKind::Insert,
                    left_line: None,
                    right_line: Some(line.to_string()),
                    char_diffs: None,
                });
            }
        } else if !del_lines.is_empty() {
            // Pure deletion
            for line in del_lines {
                changes.push(LineChange {
                    kind: ChangeKind::Delete,
                    left_line: Some(line.to_string()),
                    right_line: None,
                    char_diffs: None,
                });
            }
        } else {
            // Pure insertion
            for line in ins_lines {
                changes.push(LineChange {
                    kind: ChangeKind::Insert,
                    left_line: None,
                    right_line: Some(line.to_string()),
                    char_diffs: None,
                });
            }
        }

        hunks.push(DiffHunk {
            left_start: del_start,
            left_count: del_end - del_start,
            right_start: ins_start,
            right_count: ins_end - ins_start,
            changes,
        });

        left_pos = del_end;
        right_pos = ins_end;
    }

    // Suppress unused variable warnings
    let _ = left_pos;
    let _ = right_pos;

    hunks
}

/// Compute character-level diff between two lines (Pass 2).
/// Uses Myers algorithm since character tokens are highly repetitive
/// (Histogram falls back to Myers anyway for such cases).
fn compute_char_diff(left_line: &str, right_line: &str) -> Vec<CharSpan> {
    if left_line == right_line {
        return Vec::new();
    }

    let left_chars: Vec<char> = left_line.chars().collect();
    let right_chars: Vec<char> = right_line.chars().collect();

    // Build InternedInput manually for character tokens
    let total_estimate = left_chars.len() + right_chars.len();
    let mut interner: Interner<char> = Interner::new(total_estimate);
    let before_tokens: Vec<Token> = left_chars.iter().map(|&c| interner.intern(c)).collect();
    let after_tokens: Vec<Token> = right_chars.iter().map(|&c| interner.intern(c)).collect();

    let input = InternedInput {
        before: before_tokens,
        after: after_tokens,
        interner,
    };

    let mut spans: Vec<CharSpan> = Vec::new();

    diff(
        Algorithm::Myers,
        &input,
        |before: Range<u32>, after: Range<u32>| {
            if !before.is_empty() {
                spans.push(CharSpan {
                    side: Side::Left,
                    start: before.start as usize,
                    length: (before.end - before.start) as usize,
                });
            }
            if !after.is_empty() {
                spans.push(CharSpan {
                    side: Side::Right,
                    start: after.start as usize,
                    length: (after.end - after.start) as usize,
                });
            }
        },
    );

    spans
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identical_files() {
        let text = "line1\nline2\nline3\n";
        let result = compute_text_diff(text, text);
        assert!(result.hunks.is_empty(), "Identical files should have no hunks");
        assert_eq!(result.left_line_count, 4); // 3 lines + trailing empty
        assert_eq!(result.right_line_count, 4);
    }

    #[test]
    fn test_empty_files() {
        let result = compute_text_diff("", "");
        assert!(result.hunks.is_empty());
        assert_eq!(result.left_line_count, 0);
        assert_eq!(result.right_line_count, 0);
    }

    #[test]
    fn test_left_empty() {
        let result = compute_text_diff("", "hello\nworld\n");
        assert_eq!(result.hunks.len(), 1);
        // All changes in the hunk should be insertions
        assert!(!result.hunks[0].changes.is_empty());
        for change in &result.hunks[0].changes {
            assert_eq!(change.kind, ChangeKind::Insert);
        }
    }

    #[test]
    fn test_right_empty() {
        let result = compute_text_diff("hello\nworld\n", "");
        assert_eq!(result.hunks.len(), 1);
        for change in &result.hunks[0].changes {
            assert_eq!(change.kind, ChangeKind::Delete);
        }
    }

    #[test]
    fn test_simple_insertion() {
        let left = "line1\nline3\n";
        let right = "line1\nline2\nline3\n";
        let result = compute_text_diff(left, right);
        assert!(!result.hunks.is_empty());

        // Should have an insertion of "line2"
        let has_insert = result
            .hunks
            .iter()
            .flat_map(|h| &h.changes)
            .any(|c| c.kind == ChangeKind::Insert && c.right_line.as_deref() == Some("line2"));
        assert!(has_insert, "Should detect insertion of 'line2'");
    }

    #[test]
    fn test_simple_deletion() {
        let left = "line1\nline2\nline3\n";
        let right = "line1\nline3\n";
        let result = compute_text_diff(left, right);
        assert!(!result.hunks.is_empty());

        let has_delete = result
            .hunks
            .iter()
            .flat_map(|h| &h.changes)
            .any(|c| c.kind == ChangeKind::Delete && c.left_line.as_deref() == Some("line2"));
        assert!(has_delete, "Should detect deletion of 'line2'");
    }

    #[test]
    fn test_modification() {
        let left = "hello world\n";
        let right = "hello rust\n";
        let result = compute_text_diff(left, right);
        assert!(!result.hunks.is_empty());

        let modify = result
            .hunks
            .iter()
            .flat_map(|h| &h.changes)
            .find(|c| c.kind == ChangeKind::Modify);
        assert!(modify.is_some(), "Should detect modification");

        let modify = modify.unwrap();
        assert_eq!(modify.left_line.as_deref(), Some("hello world"));
        assert_eq!(modify.right_line.as_deref(), Some("hello rust"));
        assert!(
            modify.char_diffs.is_some(),
            "Modified lines should have char diffs"
        );
    }

    #[test]
    fn test_char_diff_detail() {
        let spans = compute_char_diff("hello world", "hello rust");
        assert!(!spans.is_empty(), "Should have character-level diffs");

        // Should highlight "world" on left side and "rust" on right side
        let left_spans: Vec<_> = spans.iter().filter(|s| s.side == Side::Left).collect();
        let right_spans: Vec<_> = spans.iter().filter(|s| s.side == Side::Right).collect();
        assert!(!left_spans.is_empty(), "Should have left-side char spans");
        assert!(!right_spans.is_empty(), "Should have right-side char spans");
    }

    #[test]
    fn test_multiple_hunks() {
        let left = "aaa\nbbb\nccc\nddd\neee\n";
        let right = "aaa\nBBB\nccc\nDDD\neee\n";
        let result = compute_text_diff(left, right);

        // Should have 2 hunks: bbb->BBB and ddd->DDD
        assert_eq!(result.hunks.len(), 2, "Should have 2 separate hunks");
    }

    #[test]
    fn test_large_identical_file() {
        let text: String = (0..10000).map(|i| format!("line {}\n", i)).collect();
        let result = compute_text_diff(&text, &text);
        assert!(result.hunks.is_empty());
    }

    #[test]
    fn test_completely_different() {
        let left = "aaa\nbbb\nccc\n";
        let right = "xxx\nyyy\nzzz\n";
        let result = compute_text_diff(left, right);
        assert!(!result.hunks.is_empty());

        let total_changes: usize = result.hunks.iter().map(|h| h.changes.len()).sum();
        assert!(total_changes > 0);
    }

    #[test]
    fn test_no_trailing_newline() {
        let left = "line1\nline2";
        let right = "line1\nline2\nline3";
        let result = compute_text_diff(left, right);
        assert!(!result.hunks.is_empty());
    }

    #[test]
    fn test_char_diff_identical() {
        let spans = compute_char_diff("same text", "same text");
        assert!(spans.is_empty());
    }

    #[test]
    fn test_char_diff_completely_different() {
        let spans = compute_char_diff("abc", "xyz");
        assert!(!spans.is_empty());
    }
}
