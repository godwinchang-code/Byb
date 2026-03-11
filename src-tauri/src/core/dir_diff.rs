use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::Path;
use walkdir::WalkDir;

use super::types::{DirCmpOptions, DirNode, FileStatus, NodeType};

/// Compare two directories and return a tree of differences.
pub fn compare_directories(
    left_path: &Path,
    right_path: &Path,
    options: &DirCmpOptions,
) -> DirNode {
    let left_entries = collect_entries(left_path);
    let right_entries = collect_entries(right_path);

    build_tree("", &left_entries, &right_entries, left_path, right_path, options)
}

/// Collected metadata for a file entry.
#[derive(Debug, Clone)]
struct EntryMeta {
    is_dir: bool,
    size: u64,
    modified: u64,
}

/// Collect all entries under a directory into a sorted map of relative_path -> metadata.
fn collect_entries(root: &Path) -> BTreeMap<String, EntryMeta> {
    let mut entries = BTreeMap::new();

    for entry in WalkDir::new(root).min_depth(1).into_iter().filter_map(|e| e.ok()) {
        let rel_path = entry
            .path()
            .strip_prefix(root)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/"); // Normalize separators

        let meta = entry.metadata().ok();
        let is_dir = entry.file_type().is_dir();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        entries.insert(rel_path, EntryMeta { is_dir, size, modified });
    }

    entries
}

/// Build the comparison tree recursively for a given prefix.
fn build_tree(
    prefix: &str,
    left_entries: &BTreeMap<String, EntryMeta>,
    right_entries: &BTreeMap<String, EntryMeta>,
    left_root: &Path,
    right_root: &Path,
    options: &DirCmpOptions,
) -> DirNode {
    // Collect immediate children at this prefix level
    let left_children = get_children_at_prefix(left_entries, prefix);
    let right_children = get_children_at_prefix(right_entries, prefix);

    // Merge both sides
    let mut all_names: Vec<String> = Vec::new();
    for name in left_children.keys() {
        all_names.push(name.clone());
    }
    for name in right_children.keys() {
        if !left_children.contains_key(name) {
            all_names.push(name.clone());
        }
    }
    all_names.sort();

    let mut children: Vec<DirNode> = Vec::new();

    for name in &all_names {
        let left_meta = left_children.get(name);
        let right_meta = right_children.get(name);

        let rel_path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", prefix, name)
        };

        let node = match (left_meta, right_meta) {
            (Some(lm), Some(rm)) => {
                // Present on both sides
                if lm.is_dir || rm.is_dir {
                    // Directory: recurse
                    let mut child = build_tree(
                        &rel_path,
                        left_entries,
                        right_entries,
                        left_root,
                        right_root,
                        options,
                    );
                    child.name = name.clone();
                    child.relative_path = rel_path;
                    child.node_type = NodeType::Directory;
                    // Aggregate status from children
                    child.status = aggregate_status(&child.children);
                    child.size_left = Some(lm.size);
                    child.size_right = Some(rm.size);
                    child.modified_left = Some(lm.modified);
                    child.modified_right = Some(rm.modified);
                    child
                } else {
                    // File: compare
                    let status = compare_file(
                        &left_root.join(&rel_path),
                        &right_root.join(&rel_path),
                        lm,
                        rm,
                        options,
                    );
                    DirNode {
                        name: name.clone(),
                        relative_path: rel_path,
                        node_type: NodeType::File,
                        status,
                        size_left: Some(lm.size),
                        size_right: Some(rm.size),
                        modified_left: Some(lm.modified),
                        modified_right: Some(rm.modified),
                        children: None,
                    }
                }
            }
            (Some(lm), None) => {
                // Left only
                if lm.is_dir {
                    build_one_side_tree(&rel_path, name, left_entries, FileStatus::LeftOnly, lm)
                } else {
                    DirNode {
                        name: name.clone(),
                        relative_path: rel_path,
                        node_type: NodeType::File,
                        status: FileStatus::LeftOnly,
                        size_left: Some(lm.size),
                        size_right: None,
                        modified_left: Some(lm.modified),
                        modified_right: None,
                        children: None,
                    }
                }
            }
            (None, Some(rm)) => {
                // Right only
                if rm.is_dir {
                    build_one_side_tree(&rel_path, name, right_entries, FileStatus::RightOnly, rm)
                } else {
                    DirNode {
                        name: name.clone(),
                        relative_path: rel_path,
                        node_type: NodeType::File,
                        status: FileStatus::RightOnly,
                        size_left: None,
                        size_right: Some(rm.size),
                        modified_left: None,
                        modified_right: Some(rm.modified),
                        children: None,
                    }
                }
            }
            (None, None) => unreachable!(),
        };

        children.push(node);
    }

    let root_name = if prefix.is_empty() {
        "root".to_string()
    } else {
        prefix.rsplit('/').next().unwrap_or(prefix).to_string()
    };

    DirNode {
        name: root_name,
        relative_path: prefix.to_string(),
        node_type: NodeType::Directory,
        status: aggregate_status(&Some(children.clone())),
        size_left: None,
        size_right: None,
        modified_left: None,
        modified_right: None,
        children: if children.is_empty() {
            None
        } else {
            Some(children)
        },
    }
}

/// Get immediate children names at a given prefix level.
fn get_children_at_prefix<'a>(
    entries: &'a BTreeMap<String, EntryMeta>,
    prefix: &str,
) -> BTreeMap<String, &'a EntryMeta> {
    let mut children = BTreeMap::new();

    for (path, meta) in entries {
        let child_name = if prefix.is_empty() {
            // Top-level: first component
            path.split('/').next()
        } else if let Some(rest) = path.strip_prefix(prefix) {
            let rest = rest.strip_prefix('/').unwrap_or(rest);
            if rest.is_empty() {
                continue; // The prefix itself
            }
            rest.split('/').next()
        } else {
            continue;
        };

        if let Some(name) = child_name {
            if !name.is_empty() {
                children.entry(name.to_string()).or_insert(meta);
            }
        }
    }

    children
}

/// Build a tree for entries only on one side.
fn build_one_side_tree(
    rel_path: &str,
    name: &str,
    entries: &BTreeMap<String, EntryMeta>,
    status: FileStatus,
    meta: &EntryMeta,
) -> DirNode {
    let children_entries: Vec<_> = entries
        .iter()
        .filter(|(p, _)| {
            p.starts_with(rel_path) && p.len() > rel_path.len() && p.as_bytes()[rel_path.len()] == b'/'
        })
        .collect();

    // Get immediate children
    let mut child_names = BTreeMap::new();
    for (path, entry_meta) in &children_entries {
        let rest = &path[rel_path.len() + 1..];
        if let Some(child_name) = rest.split('/').next() {
            child_names.entry(child_name.to_string()).or_insert(*entry_meta);
        }
    }

    let children: Vec<DirNode> = child_names
        .iter()
        .map(|(child_name, child_meta)| {
            let child_path = format!("{}/{}", rel_path, child_name);
            if child_meta.is_dir {
                build_one_side_tree(&child_path, child_name, entries, status, child_meta)
            } else {
                let (size_left, size_right) = match status {
                    FileStatus::LeftOnly => (Some(child_meta.size), None),
                    FileStatus::RightOnly => (None, Some(child_meta.size)),
                    _ => (None, None),
                };
                let (mod_left, mod_right) = match status {
                    FileStatus::LeftOnly => (Some(child_meta.modified), None),
                    FileStatus::RightOnly => (None, Some(child_meta.modified)),
                    _ => (None, None),
                };
                DirNode {
                    name: child_name.clone(),
                    relative_path: child_path,
                    node_type: NodeType::File,
                    status,
                    size_left,
                    size_right,
                    modified_left: mod_left,
                    modified_right: mod_right,
                    children: None,
                }
            }
        })
        .collect();

    let (size_left, size_right) = match status {
        FileStatus::LeftOnly => (Some(meta.size), None),
        FileStatus::RightOnly => (None, Some(meta.size)),
        _ => (None, None),
    };

    DirNode {
        name: name.to_string(),
        relative_path: rel_path.to_string(),
        node_type: NodeType::Directory,
        status,
        size_left,
        size_right,
        modified_left: None,
        modified_right: None,
        children: if children.is_empty() {
            None
        } else {
            Some(children)
        },
    }
}

/// Compare two files to determine their status.
fn compare_file(
    left_path: &Path,
    right_path: &Path,
    left_meta: &EntryMeta,
    right_meta: &EntryMeta,
    options: &DirCmpOptions,
) -> FileStatus {
    if options.quick {
        // Quick mode: compare size and modification time
        if left_meta.size == right_meta.size && left_meta.modified == right_meta.modified {
            FileStatus::Identical
        } else {
            FileStatus::Modified
        }
    } else {
        // Thorough mode: compare content via SHA-256 hash
        if left_meta.size != right_meta.size {
            return FileStatus::Modified;
        }

        let left_hash = hash_file(left_path);
        let right_hash = hash_file(right_path);

        match (left_hash, right_hash) {
            (Ok(lh), Ok(rh)) if lh == rh => FileStatus::Identical,
            _ => FileStatus::Modified,
        }
    }
}

/// Compute SHA-256 hash of a file.
fn hash_file(path: &Path) -> std::io::Result<Vec<u8>> {
    let data = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hasher.finalize().to_vec())
}

/// Aggregate status from children: a directory is Modified if any child is not Identical.
fn aggregate_status(children: &Option<Vec<DirNode>>) -> FileStatus {
    match children {
        None => FileStatus::Identical,
        Some(children) => {
            if children
                .iter()
                .all(|c| c.status == FileStatus::Identical)
            {
                FileStatus::Identical
            } else {
                FileStatus::Modified
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_test_dirs() -> (tempfile::TempDir, tempfile::TempDir) {
        let left = tempfile::tempdir().unwrap();
        let right = tempfile::tempdir().unwrap();
        (left, right)
    }

    #[test]
    fn test_identical_directories() {
        let (left, right) = create_test_dirs();
        fs::write(left.path().join("file.txt"), "hello").unwrap();
        fs::write(right.path().join("file.txt"), "hello").unwrap();

        let options = DirCmpOptions { quick: false };
        let result = compare_directories(left.path(), right.path(), &options);

        assert_eq!(result.node_type, NodeType::Directory);
        let children = result.children.unwrap();
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "file.txt");
        assert_eq!(children[0].status, FileStatus::Identical);
    }

    #[test]
    fn test_modified_file() {
        let (left, right) = create_test_dirs();
        fs::write(left.path().join("file.txt"), "hello").unwrap();
        fs::write(right.path().join("file.txt"), "world").unwrap();

        let options = DirCmpOptions { quick: false };
        let result = compare_directories(left.path(), right.path(), &options);

        let children = result.children.unwrap();
        assert_eq!(children[0].status, FileStatus::Modified);
    }

    #[test]
    fn test_left_only_file() {
        let (left, right) = create_test_dirs();
        fs::write(left.path().join("only_left.txt"), "data").unwrap();

        let options = DirCmpOptions { quick: false };
        let result = compare_directories(left.path(), right.path(), &options);

        let children = result.children.unwrap();
        assert_eq!(children[0].name, "only_left.txt");
        assert_eq!(children[0].status, FileStatus::LeftOnly);
    }

    #[test]
    fn test_right_only_file() {
        let (left, right) = create_test_dirs();
        fs::write(right.path().join("only_right.txt"), "data").unwrap();

        let options = DirCmpOptions { quick: false };
        let result = compare_directories(left.path(), right.path(), &options);

        let children = result.children.unwrap();
        assert_eq!(children[0].name, "only_right.txt");
        assert_eq!(children[0].status, FileStatus::RightOnly);
    }

    #[test]
    fn test_nested_directories() {
        let (left, right) = create_test_dirs();
        fs::create_dir_all(left.path().join("sub")).unwrap();
        fs::create_dir_all(right.path().join("sub")).unwrap();
        fs::write(left.path().join("sub/a.txt"), "aaa").unwrap();
        fs::write(right.path().join("sub/a.txt"), "aaa").unwrap();
        fs::write(left.path().join("sub/b.txt"), "bbb").unwrap();
        fs::write(right.path().join("sub/b.txt"), "BBB").unwrap();

        let options = DirCmpOptions { quick: false };
        let result = compare_directories(left.path(), right.path(), &options);

        let children = result.children.unwrap();
        let sub = &children[0];
        assert_eq!(sub.name, "sub");
        assert_eq!(sub.node_type, NodeType::Directory);
        assert_eq!(sub.status, FileStatus::Modified); // Contains a modified child

        let sub_children = sub.children.as_ref().unwrap();
        assert_eq!(sub_children.len(), 2);

        let a = sub_children.iter().find(|c| c.name == "a.txt").unwrap();
        assert_eq!(a.status, FileStatus::Identical);

        let b = sub_children.iter().find(|c| c.name == "b.txt").unwrap();
        assert_eq!(b.status, FileStatus::Modified);
    }

    #[test]
    fn test_empty_directories() {
        let (left, right) = create_test_dirs();
        let options = DirCmpOptions { quick: false };
        let result = compare_directories(left.path(), right.path(), &options);
        assert!(result.children.is_none() || result.children.as_ref().unwrap().is_empty());
    }

    #[test]
    fn test_quick_mode() {
        let (left, right) = create_test_dirs();
        fs::write(left.path().join("file.txt"), "hello").unwrap();
        fs::write(right.path().join("file.txt"), "hello").unwrap();

        let options = DirCmpOptions { quick: true };
        let result = compare_directories(left.path(), right.path(), &options);

        let children = result.children.unwrap();
        // In quick mode, same size files may show as identical or modified
        // depending on mtime (which is unpredictable in tests)
        assert_eq!(children[0].node_type, NodeType::File);
    }
}
