# byb (Beyond Your Beyond) — V1 Specification

## 1. Project Overview

### 1.1 Vision

**byb** is a modern, open-source, cross-platform file and directory comparison tool. Inspired by Beyond Compare, it aims to provide a fast, lightweight alternative built on Rust and web technologies.

### 1.2 Target Platforms

- Windows 10+
- macOS 12+
- Linux (Ubuntu 22.04+, Fedora 38+, Arch)

### 1.3 Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust |
| Framework | Tauri 2 |
| Frontend | React 18+ / TypeScript |
| Editor | CodeMirror 6 |

---

## 2. V1 Scope Definition

### 2.1 In Scope (V1)

| ID | Feature | Description |
|----|---------|-------------|
| F-01 | Side-by-side layout | Two-panel resizable split view as the primary layout |
| F-02 | Directory comparison | Recursive tree view comparing two directory trees, with file status indicators (added, removed, modified, identical) |
| F-03 | Directory filtering | Filter tree view to show only differences or specific status types |
| F-04 | Text file comparison | Line-level diff with inline character-level change highlighting |
| F-05 | Bidirectional editing | Edit either side directly in the text comparison view |
| F-06 | Merge operations | Merge individual diff hunks from one side to the other via UI controls |
| F-07 | Syntax highlighting | Language-aware syntax highlighting in text comparison |
| F-08 | Binary file comparison | Hex dump view (offset / hex bytes / ASCII) with byte-level difference highlighting, read-only |
| F-09 | Diff navigation | Navigate between differences (next/previous) in all comparison modes |
| F-10 | File operations | Copy files from one side to the other in directory comparison |
| F-11 | File save | Save edited files back to disk from text comparison view |
| F-12 | Path selection | Select directories/files via native file picker dialog |
| F-13 | Drag and drop | Drag directories/files onto panels to set comparison paths |
| F-14 | Keyboard shortcuts | Keyboard shortcuts for all major navigation and operations |
| F-15 | Session persistence | Remember last compared paths across application restarts |
| F-16 | Home screen | Welcome screen with path selection and recent sessions |

### 2.2 Out of Scope (V1)

The following features are explicitly **excluded** from V1. They may be considered for future versions.

| Feature | Reason |
|---------|--------|
| Three-way merge | Significant complexity; V1 focuses on two-way comparison |
| FTP / SFTP / cloud storage | V1 is local filesystem only |
| Archive comparison (zip, tar, etc.) | Requires archive extraction layer |
| Image comparison | Different diff paradigm; deferred |
| Windows registry comparison | Platform-specific feature |
| Folder sync / mirroring | Goes beyond comparison into file management |
| Plugin / extension system | Premature abstraction for V1 |
| Custom comparison rules / regex filters | Adds configuration complexity |
| Command-line interface (CLI) | V1 is GUI-only |
| Version control integration (git difftool/mergetool) | Can be added after core stabilizes |
| Multi-tab / multi-session | V1 is single session per window |
| Internationalization (i18n) | English only in V1 |
| Dark / light theme toggle | Ship with one well-designed theme; theming in V2 |

---

## 3. User Stories

### 3.1 Directory Comparison

**US-D1**: As a user, I can select two directories (via file picker or drag-and-drop) and see a recursive tree view showing all files and subdirectories with their comparison status.

**US-D2**: As a user, I can filter the tree to show only differences (hiding identical files) so I can focus on what changed.

**US-D3**: As a user, I can double-click a file pair in the tree to open the appropriate comparison view (text or binary) for that file.

**US-D4**: As a user, I can copy a file from one side to the other to synchronize a specific difference.

**US-D5**: As a user, I can expand/collapse directory nodes and see an aggregate status indicator showing whether a directory contains any differences.

### 3.2 Text File Comparison

**US-T1**: As a user, I can see two text files side-by-side with differences highlighted at the line level, and specific changed characters/words highlighted within modified lines.

**US-T2**: As a user, I can edit either side of the comparison directly in the editor panel.

**US-T3**: As a user, I can navigate between differences using "next diff" / "previous diff" controls (buttons and keyboard shortcuts).

**US-T4**: As a user, I can merge a specific diff hunk from one side to the other by clicking a merge control on that hunk.

**US-T5**: As a user, I can save modifications back to the original file on disk.

**US-T6**: As a user, I can see line numbers and syntax highlighting appropriate to the file type (detected by file extension).

### 3.3 Binary File Comparison

**US-B1**: As a user, I can see two files in a hex view (offset | hex bytes | ASCII representation) displayed side-by-side.

**US-B2**: As a user, differing bytes are highlighted in the hex view so I can visually identify differences.

**US-B3**: As a user, I can navigate to the next/previous byte difference.

### 3.4 General UI

**US-G1**: As a user, I can open a new comparison session from a home/welcome screen by selecting paths.

**US-G2**: As a user, the application remembers my last compared paths and offers them on startup.

**US-G3**: As a user, I can use keyboard shortcuts for all major operations (navigate diffs, merge, save, switch panels).

---

## 4. Acceptance Criteria

### 4.1 Directory Comparison

| ID | Criteria |
|----|----------|
| AC-D1.1 | Given two valid directory paths, the tree displays all files and subdirectories recursively |
| AC-D1.2 | Files only on the left are marked with a distinct "left only" visual indicator |
| AC-D1.3 | Files only on the right are marked with a distinct "right only" visual indicator |
| AC-D1.4 | Files present on both sides with different content are marked "modified" |
| AC-D1.5 | Files present on both sides with identical content are marked "identical" |
| AC-D1.6 | Directory comparison of 10,000 files completes in under 5 seconds (quick mode) |
| AC-D2.1 | Toggling the "show differences only" filter hides all identical files from the tree |
| AC-D3.1 | Double-clicking a text file pair opens the text comparison view |
| AC-D3.2 | Double-clicking a binary file pair opens the binary comparison view |
| AC-D3.3 | File type detection uses UTF-8 validity: files that pass UTF-8 decoding open as text; others open as binary |
| AC-D4.1 | Copying a file from left to right replaces the right-side file with the left-side content |
| AC-D4.2 | After copy, the tree updates the status of the affected file to "identical" |
| AC-D5.1 | A collapsed directory node shows a "contains differences" indicator if any descendant file is not identical |

### 4.2 Text File Comparison

| ID | Criteria |
|----|----------|
| AC-T1.1 | Inserted lines (present on one side only) are highlighted with a distinct background color |
| AC-T1.2 | Deleted lines are highlighted with a different distinct background color |
| AC-T1.3 | Modified lines show line-level highlighting, with additional inline character-level highlighting for the specific changes |
| AC-T1.4 | Diff computation for files up to 100,000 lines completes in under 3 seconds |
| AC-T1.5 | Both editor panels scroll synchronously, with diff regions visually aligned |
| AC-T2.1 | The user can place a cursor in either editor panel and type to edit the content |
| AC-T2.2 | After editing, the diff is recomputed and the display updates (within 1 second of stopping typing) |
| AC-T3.1 | "Next diff" navigates to the next diff hunk and scrolls both panels to show it |
| AC-T3.2 | "Previous diff" navigates to the previous diff hunk |
| AC-T3.3 | A status indicator shows "diff N of M" (current position and total count) |
| AC-T4.1 | Clicking the merge control on a diff hunk copies that hunk's content from source to destination |
| AC-T4.2 | After merge, the diff recomputes and the merged hunk disappears if sides now match |
| AC-T5.1 | "Save" writes the current editor content to the original file path |
| AC-T5.2 | If the file has been modified externally since opening, a confirmation dialog warns the user before overwriting |
| AC-T6.1 | Line numbers are visible in the gutter of both editor panels |
| AC-T6.2 | Syntax highlighting is applied based on file extension detection |

### 4.3 Binary File Comparison

| ID | Criteria |
|----|----------|
| AC-B1.1 | Each row displays: 8-digit hex offset, 16 hex byte values (grouped in pairs), 16 ASCII characters |
| AC-B1.2 | Non-printable bytes display as `.` in the ASCII column |
| AC-B1.3 | The hex view supports scrolling through the entire file without loading it all into memory |
| AC-B2.1 | Bytes that differ between the two files are highlighted with a distinct color |
| AC-B3.1 | "Next difference" scrolls to the next byte range where files differ |
| AC-B3.2 | "Previous difference" scrolls to the previous differing byte range |

### 4.4 General UI

| ID | Criteria |
|----|----------|
| AC-G1.1 | The home screen provides two path input areas (left/right) with "Browse" buttons that open native file picker dialogs |
| AC-G1.2 | After selecting paths, clicking "Compare" opens the appropriate comparison view |
| AC-G2.1 | On startup, the home screen shows the most recently compared path pairs (up to 10) |
| AC-G2.2 | Clicking a recent session entry restores both paths and starts comparison |
| AC-G3.1 | `Ctrl/Cmd+S` saves the current file |
| AC-G3.2 | `Alt+Down` / `Alt+Up` navigates to next/previous diff |
| AC-G3.3 | `Ctrl/Cmd+Shift+Right` / `Ctrl/Cmd+Shift+Left` merges the current hunk to the other side |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target |
|--------|--------|
| Directory comparison (10,000 files, quick mode) | < 5 seconds |
| Directory comparison (10,000 files, thorough mode with content hash) | < 30 seconds |
| Text diff computation (100,000 lines) | < 3 seconds |
| Re-diff after edit (100,000 lines) | < 2 seconds |
| Binary file hex view initial load | < 1 second |
| UI frame rate during scrolling | >= 30 fps |

### 5.2 Memory

- Directory tree must use virtual scrolling when exceeding 1,000 visible nodes.
- Text editor relies on CodeMirror 6's built-in virtualization (renders only visible lines).
- Binary hex view uses chunked file reading with a sliding window. Maximum resident memory for binary view: 16 MB per file.
- Total application memory usage should stay under 500 MB for typical workloads.

### 5.3 Cross-Platform

- Must function correctly on all three target platforms without platform-specific workarounds.
- UI rendering may have minor visual differences across platforms due to WebView engine differences (WebView2 on Windows, WebKit on macOS, WebKitGTK on Linux).
- File path handling must correctly handle platform-specific separators and conventions.

### 5.4 Accessibility

- All core operations must be keyboard-navigable.
- Diff highlighting colors must have sufficient contrast (WCAG 2.1 AA minimum).
- Focus indicators must be visible on all interactive elements.

### 5.5 Distribution

- Platform-native installers via Tauri's built-in bundler:
  - Windows: MSI or NSIS installer
  - macOS: DMG with drag-to-Applications
  - Linux: AppImage and .deb package

---

## 6. Constraints and Assumptions

### 6.1 File Size Limits

- **Text diff**: Maximum 50 MB per file. Files exceeding this threshold display a warning and offer to open in binary mode instead.
- **Binary hex view**: No hard size limit. Files are read in chunks; only the visible viewport window is loaded into memory.

### 6.2 Encoding

- **Primary encoding**: UTF-8. Files are attempted as UTF-8 first.
- **Fallback**: Files that fail UTF-8 validation are treated as binary and opened in hex view.
- **BOM handling**: UTF-8 BOM is detected and preserved but not displayed.

### 6.3 Line Endings

- Line endings (CRLF / LF / CR) are normalized for comparison purposes.
- Original line endings are preserved when saving files.
- Mixed line endings within a file are handled gracefully (no crashes or corruption).

### 6.4 Filesystem

- Symbolic links are followed (not compared as links).
- Hidden files and directories (dotfiles, system hidden attribute) are included by default.
- Permission errors on individual files are reported in the UI but do not abort the entire comparison.

### 6.5 Concurrency

- All heavy computations (diff, directory walk, hash) run on background threads. The UI thread must never block.
- Long-running operations display a progress indicator with the option to cancel.

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| Diff | The result of comparing two files or directories, identifying their differences |
| Diff hunk | A contiguous block of changes between two files (one or more adjacent changed lines) |
| Merge | The operation of copying a diff hunk from one side to the other |
| Phantom line | An empty placeholder line inserted in one editor to visually align corresponding lines in the other editor |
| Quick mode | Directory comparison using only file metadata (size + modification time) |
| Thorough mode | Directory comparison using content hashing (SHA-256) for accurate detection |
| Virtual scrolling | Rendering only the visible portion of a large list, creating/destroying DOM elements as the user scrolls |
| Side | One of the two panels in a comparison view (left or right) |
