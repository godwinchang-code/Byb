use serde::{Deserialize, Serialize};

/// Represents which side of the comparison.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Left,
    Right,
}

/// File status in directory comparison.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileStatus {
    LeftOnly,
    RightOnly,
    Modified,
    Identical,
}

/// Type of a directory entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeType {
    File,
    Directory,
}

/// The kind of change for a line in a diff.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeKind {
    Equal,
    Insert,
    Delete,
    Modify,
}

/// A character-level diff span within a modified line.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharSpan {
    pub side: Side,
    pub start: usize,
    pub length: usize,
}

/// A single line change within a diff hunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineChange {
    pub kind: ChangeKind,
    pub left_line: Option<String>,
    pub right_line: Option<String>,
    pub char_diffs: Option<Vec<CharSpan>>,
}

/// A diff hunk containing one or more line changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub left_start: usize,
    pub left_count: usize,
    pub right_start: usize,
    pub right_count: usize,
    pub changes: Vec<LineChange>,
}

/// Result of comparing two text files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextDiffResult {
    pub hunks: Vec<DiffHunk>,
    pub left_line_count: usize,
    pub right_line_count: usize,
    pub left_encoding: String,
    pub right_encoding: String,
}

/// A byte range where files differ in binary comparison.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByteRange {
    pub offset: u64,
    pub length: u64,
}

/// Result of comparing two binary files.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinDiffResult {
    pub diff_ranges: Vec<ByteRange>,
    pub total_size_left: u64,
    pub total_size_right: u64,
}

/// A node in the directory comparison tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirNode {
    pub name: String,
    pub relative_path: String,
    pub node_type: NodeType,
    pub status: FileStatus,
    pub size_left: Option<u64>,
    pub size_right: Option<u64>,
    pub modified_left: Option<u64>,
    pub modified_right: Option<u64>,
    pub children: Option<Vec<DirNode>>,
}

/// Options for directory comparison.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirCmpOptions {
    pub quick: bool,
}
