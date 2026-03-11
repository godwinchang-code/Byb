# byb (Beyond Your Beyond) — System Design Document

## 1. Architecture Overview

byb follows a three-layer architecture: **Frontend (WebView)** communicates with the **Backend (Rust)** through **Tauri IPC**.

```
┌──────────────────────────────────────────────────┐
│                Frontend (WebView)                 │
│         React 18 + TypeScript + CodeMirror 6      │
│  ┌──────────────────────────────────────────────┐ │
│  │     App Shell (Layout, Routing, State)        │ │
│  │  ┌────────────┐ ┌───────────┐ ┌───────────┐  │ │
│  │  │ DirCompare │ │ TextComp  │ │ BinCompare│  │ │
│  │  │    View    │ │   View    │ │    View   │  │ │
│  │  └────────────┘ └───────────┘ └───────────┘  │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────┬──┬─────────────────────────┘
                      │  │
              Tauri IPC (Commands + Events + Channels)
                      │  │
┌─────────────────────┴──┴─────────────────────────┐
│                Backend (Rust)                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐       │
│  │ commands/ │  │  core/   │  │  utils/   │       │
│  │ (IPC API) │  │(Algorithms│  │(Encoding, │       │
│  │          │  │ & Logic) │  │  Paths)   │       │
│  └──────────┘  └──────────┘  └───────────┘       │
└──────────────────────────────────────────────────┘
```

### 1.1 Layer Responsibilities

| Layer | Responsibility |
|-------|---------------|
| **Frontend** | UI rendering, user interaction, editor integration, state management. No direct file I/O. |
| **Tauri IPC** | Request/response commands for operations; events for progress updates; channels for streaming large results. |
| **Backend** | All file I/O, diff computation, directory traversal, content hashing. Exposes functionality exclusively via Tauri commands. |

### 1.2 Design Principles

1. **Heavy work in Rust**: All CPU-intensive operations (diff, hash, file read) run in the Rust backend on background threads. The frontend never performs file operations directly.
2. **Streaming for large data**: Directory trees and binary data are streamed via Tauri channels rather than returned as single large JSON payloads.
3. **Stateless commands**: Each Tauri command is stateless and self-contained. Session state is managed in the frontend (Zustand) and persisted to disk via dedicated commands.

---

## 2. Technology Selection

### 2.1 Editor: CodeMirror 6

**Decision**: Use CodeMirror 6 instead of Monaco Editor.

| Factor | CodeMirror 6 | Monaco Editor |
|--------|-------------|---------------|
| Bundle size | ~300 KB | 5-10 MB |
| Diff view customization | Full control via extensions | Built-in diff is read-only |
| Bidirectional editing in diff | Achievable via custom extensions | Not supported in diff mode |
| TypeScript support | First-class | Good |
| Modular architecture | Yes (tree-shakeable) | Monolithic |

CodeMirror 6's extension system allows building custom gutter decorations (merge arrows), inline diff highlights, and synchronized scrolling — all required for the text comparison view.

### 2.2 Diff Algorithm: imara-diff

**Decision**: Use the `imara-diff` crate with Histogram algorithm.

| Factor | imara-diff (Histogram) | similar (Myers) |
|--------|----------------------|-----------------|
| Performance | 10-100% faster across varied workloads | Baseline |
| Worst-case behavior | Guaranteed non-quadratic | O(N*M) possible |
| Line + char diff | Supported via token abstraction | Supported |
| Maintenance | Actively maintained | Actively maintained |

The Histogram algorithm is particularly effective for code files where many lines are similar but not identical.

### 2.3 Other Key Dependencies

| Dependency | Purpose |
|-----------|---------|
| `walkdir` | Recursive directory traversal |
| `sha2` | SHA-256 content hashing for thorough directory comparison |
| `@tanstack/react-virtual` | Virtual scrolling for directory tree and hex view |
| `zustand` | Lightweight global state management |

---

## 3. Backend Module Design

### 3.1 Module Layout

```
src-tauri/src/
├── main.rs                  -- Desktop entry point (Tauri bootstrap)
├── lib.rs                   -- App builder, command registration
├── commands/
│   ├── mod.rs               -- Re-exports all command modules
│   ├── dir_cmp.rs           -- Directory comparison commands
│   ├── text_cmp.rs          -- Text file comparison commands
│   ├── bin_cmp.rs           -- Binary file comparison commands
│   ├── file_ops.rs          -- File copy, save, read operations
│   └── session.rs           -- Session persistence commands
├── core/
│   ├── mod.rs               -- Re-exports
│   ├── dir_diff.rs          -- Directory tree walk & comparison logic
│   ├── text_diff.rs         -- Text diff engine (wraps imara-diff)
│   ├── bin_diff.rs          -- Binary diff engine
│   └── types.rs             -- Shared data types
└── utils/
    ├── mod.rs
    ├── encoding.rs           -- UTF-8 detection, encoding handling
    └── path.rs               -- Cross-platform path normalization
```

### 3.2 Core Module Details

#### 3.2.1 `core::dir_diff` — Directory Comparison

**Algorithm** (satisfies US-D1, US-D2, US-D5):

1. **Walk**: Traverse both directory trees in parallel using `walkdir`, collecting `(relative_path, metadata)` entries.
2. **Sort**: Sort both entry lists by relative path.
3. **Merge-Join**: Iterate both sorted lists simultaneously (merge-sort join):
   - Entry only in left → status = `LeftOnly`
   - Entry only in right → status = `RightOnly`
   - Entry in both → compare further
4. **Compare** (for entries in both):
   - **Quick mode**: Compare size + modification time. If both match → `Identical`, else → `Modified`.
   - **Thorough mode**: Compute SHA-256 hash of file content. If hashes match → `Identical`, else → `Modified`.
5. **Aggregate**: Propagate status upward — a directory is marked `Modified` if any descendant is not `Identical`.
6. **Stream**: Emit results via Tauri channel in batches of ~100 nodes for UI responsiveness.

**Data structure**:

```rust
#[derive(Serialize)]
pub struct DirNode {
    pub name: String,
    pub relative_path: String,
    pub node_type: NodeType,       // File | Directory
    pub status: FileStatus,        // LeftOnly | RightOnly | Modified | Identical
    pub size_left: Option<u64>,
    pub size_right: Option<u64>,
    pub modified_left: Option<u64>, // Unix timestamp
    pub modified_right: Option<u64>,
    pub children: Option<Vec<DirNode>>,
}

#[derive(Serialize)]
pub enum FileStatus {
    LeftOnly,
    RightOnly,
    Modified,
    Identical,
}
```

#### 3.2.2 `core::text_diff` — Text Diff Engine

**Algorithm** (satisfies US-T1):

Two-pass diff approach:

**Pass 1 — Line-level diff**:
- Tokenize both files into lines.
- Run `imara-diff` Histogram algorithm on line tokens.
- Produce a list of `DiffHunk` entries, each classified as `Equal`, `Insert`, `Delete`, or `Modify`.

**Pass 2 — Character-level refinement**:
- For each `Modify` hunk (lines changed on both sides), take the paired lines.
- Run `imara-diff` again on character tokens within each line pair.
- Produce `CharSpan` entries marking the exact character ranges that changed.

```rust
#[derive(Serialize)]
pub struct TextDiffResult {
    pub hunks: Vec<DiffHunk>,
    pub left_line_count: usize,
    pub right_line_count: usize,
    pub left_encoding: String,
    pub right_encoding: String,
}

#[derive(Serialize)]
pub struct DiffHunk {
    pub left_start: usize,      // 0-based line number
    pub left_count: usize,
    pub right_start: usize,
    pub right_count: usize,
    pub changes: Vec<LineChange>,
}

#[derive(Serialize)]
pub struct LineChange {
    pub kind: ChangeKind,       // Equal | Insert | Delete | Modify
    pub left_line: Option<String>,
    pub right_line: Option<String>,
    pub char_diffs: Option<Vec<CharSpan>>,  // Only for Modify
}

#[derive(Serialize)]
pub struct CharSpan {
    pub side: Side,             // Left | Right
    pub start: usize,          // Character offset
    pub length: usize,
}
```

#### 3.2.3 `core::bin_diff` — Binary Diff Engine

**Algorithm** (satisfies US-B1, US-B2):

- Read both files in aligned 64 KB chunks.
- Compare byte-by-byte within each chunk.
- Collapse consecutive differing bytes into ranges.
- Return a list of `(offset, length)` diff ranges.

```rust
#[derive(Serialize)]
pub struct BinDiffResult {
    pub diff_ranges: Vec<ByteRange>,
    pub total_size_left: u64,
    pub total_size_right: u64,
}

#[derive(Serialize)]
pub struct ByteRange {
    pub offset: u64,
    pub length: u64,
}
```

---

## 4. Tauri Command API

All commands follow Tauri 2's invoke pattern. Frontend calls `invoke("command_name", { args })` and receives a typed response.

### 4.1 Directory Comparison

```typescript
// Initiate directory comparison
// For large directories, results are streamed via a Tauri channel
invoke("compare_directories", {
  left: string,       // Absolute path to left directory
  right: string,      // Absolute path to right directory
  options: {
    quick: boolean,   // true = metadata only, false = content hash
  }
}) -> DirNode          // Root node of the comparison tree
```

### 4.2 Text File Comparison

```typescript
// Compare two text files
invoke("compare_text_files", {
  left: string,       // Absolute path to left file
  right: string,      // Absolute path to right file
}) -> TextDiffResult

// Read a portion of a text file (for lazy loading)
invoke("read_text_file", {
  path: string,
  offset: number,     // Byte offset
  limit: number,      // Max bytes to read
}) -> { content: string, total_size: number }

// Save text content back to file
invoke("save_text_file", {
  path: string,
  content: string,
}) -> void
```

### 4.3 Binary File Comparison

```typescript
// Compare binary files (returns diff ranges, not full content)
invoke("compare_binary_files", {
  left: string,
  right: string,
}) -> BinDiffResult

// Read a binary chunk for hex view display
// Uses tauri::ipc::Response for raw bytes (avoids JSON serialization)
invoke("read_binary_chunk", {
  path: string,
  offset: number,     // Byte offset
  length: number,     // Bytes to read (max 1 MB per call)
}) -> Uint8Array
```

### 4.4 File Operations

```typescript
// Copy a file from source to destination
invoke("copy_file", {
  src: string,
  dest: string,
}) -> void

// Open native directory picker
invoke("pick_directory") -> string | null

// Open native file picker
invoke("pick_file") -> string | null
```

### 4.5 Session Management

```typescript
// Load persisted session data
invoke("load_session") -> {
  recent_sessions: Array<{
    left: string,
    right: string,
    type: "directory" | "file",
    timestamp: number,
  }>,
  window_state: { width: number, height: number, x: number, y: number } | null,
}

// Save session data
invoke("save_session", {
  data: SessionData,
}) -> void
```

### 4.6 Error Contract

All commands return `Result<T, AppError>`. Errors are serialized as:

```typescript
interface AppError {
  code: "IO_ERROR" | "ENCODING_ERROR" | "FILE_TOO_LARGE"
        | "PERMISSION_DENIED" | "NOT_FOUND" | "CANCELLED";
  message: string;       // Human-readable message
  path?: string;         // File path related to the error, if applicable
}
```

---

## 5. Frontend Architecture

### 5.1 Component Hierarchy

```
src/
├── app/
│   ├── App.tsx                       -- Root: router + global providers
│   └── Layout.tsx                    -- Toolbar + content area + status bar
├── features/
│   ├── home/
│   │   └── components/
│   │       ├── HomeView.tsx          -- Welcome screen (US-G1)
│   │       └── RecentSessions.tsx    -- Recent session list (US-G2)
│   ├── dir-compare/
│   │   ├── components/
│   │   │   ├── DirCompareView.tsx    -- Container (US-D1)
│   │   │   ├── DirTree.tsx           -- Virtualized tree panel
│   │   │   ├── DirTreeNode.tsx       -- Single tree row with status
│   │   │   └── DirToolbar.tsx        -- Filter, refresh, swap controls
│   │   ├── hooks/
│   │   │   └── useDirCompare.ts      -- Orchestrates comparison
│   │   └── types/
│   │       └── dir-types.ts
│   ├── text-compare/
│   │   ├── components/
│   │   │   ├── TextCompareView.tsx   -- Container (US-T1)
│   │   │   ├── DiffEditor.tsx        -- CodeMirror 6 wrapper with diff
│   │   │   ├── DiffGutter.tsx        -- Merge arrow gutter (US-T4)
│   │   │   ├── DiffMinimap.tsx       -- Overview bar for diff locations
│   │   │   └── TextToolbar.tsx       -- Nav, save, diff counter (US-T3)
│   │   ├── hooks/
│   │   │   ├── useTextCompare.ts     -- Orchestrates text comparison
│   │   │   └── useSyncScroll.ts      -- Synchronized scrolling
│   │   ├── extensions/
│   │   │   ├── diff-highlight.ts     -- CM6 extension: line + char diff
│   │   │   └── merge-gutter.ts       -- CM6 extension: merge arrows
│   │   └── types/
│   │       └── text-types.ts
│   └── binary-compare/
│       ├── components/
│       │   ├── BinaryCompareView.tsx  -- Container (US-B1)
│       │   ├── HexView.tsx           -- Virtualized hex panel
│       │   ├── HexRow.tsx            -- Single hex row
│       │   └── BinaryToolbar.tsx     -- Navigation controls
│       ├── hooks/
│       │   └── useBinaryCompare.ts
│       └── types/
│           └── binary-types.ts
├── components/
│   ├── ui/                           -- Shared UI primitives
│   ├── SplitPane.tsx                 -- Resizable left/right split
│   ├── PathPicker.tsx                -- Path input + browse + drop
│   └── StatusBar.tsx                 -- Bottom bar: file info, encoding
├── hooks/
│   ├── useTauriCommand.ts            -- Generic invoke wrapper
│   └── useTauriEvent.ts              -- Generic event listener wrapper
├── stores/
│   ├── session-store.ts              -- Zustand: session/preferences
│   └── comparison-store.ts           -- Zustand: active comparison state
└── lib/
    └── tauri-api.ts                  -- Typed wrappers for all commands
```

### 5.2 View Routing

The application uses simple state-based routing (no URL router needed for a desktop app):

```
HomeView  ──(select paths)──>  DirCompareView  ──(double-click file)──>  TextCompareView
                                                                     ──>  BinaryCompareView
HomeView  ──(select files)──>  TextCompareView
                           ──>  BinaryCompareView
```

Navigation state is managed in `comparison-store`:

```typescript
interface ComparisonState {
  view: "home" | "dir-compare" | "text-compare" | "binary-compare";
  leftPath: string | null;
  rightPath: string | null;
  dirTree: DirNode | null;
  textDiff: TextDiffResult | null;
  binDiff: BinDiffResult | null;
  currentDiffIndex: number;
  totalDiffs: number;
}
```

---

## 6. State Management

Three-layer strategy:

| Layer | Tool | Scope | Examples |
|-------|------|-------|---------|
| Component-local | `useState` / `useReducer` | Single component | Cursor position, scroll offset, expanded/collapsed tree nodes |
| Global UI | Zustand | Cross-component | Active view, comparison paths, diff results, current diff index, panel sizes |
| Persisted | Tauri backend | Cross-session | Recent sessions, window geometry, user preferences |

### 6.1 Data Flow: Text Comparison

```
1. User selects two files on HomeView
2. comparison-store.view = "text-compare", leftPath/rightPath set
3. TextCompareView mounts, useTextCompare hook fires
4. Hook calls invoke("compare_text_files", { left, right })
5. Rust: imara-diff runs on background thread via tokio::spawn_blocking
6. Rust returns TextDiffResult as JSON
7. Hook stores result in comparison-store
8. TextCompareView reads store, passes hunks to DiffEditor (left) + DiffEditor (right)
9. CodeMirror extensions (diff-highlight, merge-gutter) consume hunk data
10. Extensions render line/char decorations and merge arrow widgets

On edit:
11. User types in left DiffEditor
12. Debounce 500ms, then call invoke("compare_text_files") with updated content
13. New TextDiffResult replaces old in store
14. UI re-renders with updated diff

On merge:
15. User clicks merge arrow on a hunk
16. Hook copies hunk content from source to destination in local state
17. Re-diff (same flow as edit)
```

---

## 7. Key Algorithms

### 7.1 Synchronized Scrolling

The most complex UI coordination challenge. When one editor scrolls, the other must scroll to show corresponding content, accounting for inserted/deleted lines that create misalignment.

**Line Mapping Table**:

Built from `TextDiffResult.hunks`:

```
Left Line → Right Line (correspondence mapping)

Example with a hunk: left lines 10-12 deleted, right has nothing:
  Left 1  → Right 1   (equal region)
  ...
  Left 9  → Right 9
  Left 10 → (phantom)  // deleted line, no right counterpart
  Left 11 → (phantom)
  Left 12 → (phantom)
  Left 13 → Right 10
  ...
```

**Phantom Lines**:

- When left has lines that right doesn't (delete), insert phantom lines in the right editor at the corresponding position.
- When right has lines that left doesn't (insert), insert phantom lines in the left editor.
- Phantom lines are CodeMirror widget decorations with a distinct background color and zero interactivity.
- This ensures corresponding lines always appear at the same vertical position.

**Scroll Synchronization Algorithm**:

```
1. Editor A fires scroll event with new scrollTop
2. Compute the topmost visible line in Editor A
3. Look up the corresponding line in Editor B via the line mapping table
4. Compute the pixel offset for that line in Editor B
5. Set a "scroll lock" flag to prevent feedback loops
6. Programmatically scroll Editor B to the computed offset
7. Clear the "scroll lock" flag after scroll settles
```

### 7.2 Virtual Scrolling for Directory Tree

The directory tree is flattened for virtual scrolling:

```
Flat list = [
  { node: "src/",      depth: 0, expanded: true  },
  { node: "src/main.rs", depth: 1, expanded: false },
  { node: "src/lib.rs",  depth: 1, expanded: false },
  { node: "tests/",     depth: 0, expanded: false },  // collapsed, children hidden
]
```

- `@tanstack/react-virtual` virtualizes this flat list (renders ~50-100 visible rows).
- Expanding/collapsing a node inserts/removes its children in the flat list.
- Indentation is computed from `depth` (e.g., `paddingLeft = depth * 20px`).

### 7.3 Hex View Chunked Loading

For the binary comparison hex view, the file is not loaded entirely:

```
1. Compute total rows = ceil(file_size / 16)
2. Virtual scroller reports visible row range [startRow, endRow]
3. Compute byte range: offset = startRow * 16, length = (endRow - startRow + 1) * 16
4. Call invoke("read_binary_chunk", { path, offset, length })
5. Render received bytes as hex rows
6. Prefetch: also load 1 viewport-height above and below for smooth scrolling
7. Cache recently loaded chunks; evict when cache exceeds 16 MB
```

---

## 8. Performance Strategy

| Scenario | Strategy |
|----------|----------|
| Large directory (>10K files) | Stream results via Tauri channel in batches; virtual scrolling in tree view |
| Large text file (>50K lines) | CodeMirror 6 native virtualization; diff computed via `tokio::spawn_blocking` on a background thread |
| Very large text file (>50MB) | Reject for text diff; display warning; offer binary mode fallback |
| Large binary file (>1GB) | Chunked reading; hex view only loads visible window + prefetch buffer |
| IPC overhead for binary data | Use `tauri::ipc::Response` for raw byte transfers (avoids JSON base64 encoding) |
| Re-diff after edit | Debounce 500ms after last keystroke; run diff on background thread; apply results when ready |
| Directory content hashing | Parallelize SHA-256 computation across files using `rayon` or `tokio::spawn_blocking` pool |
| Cancellation | Long-running operations accept a `CancellationToken`; frontend can cancel via a dedicated command |

---

## 9. Error Handling

### 9.1 Backend

Unified error type:

```rust
#[derive(Debug, thiserror::Error, Serialize)]
pub enum AppError {
    #[error("I/O error: {message}")]
    IoError { message: String, path: Option<String> },

    #[error("Encoding error: {message}")]
    EncodingError { message: String, path: Option<String> },

    #[error("File too large: {path} ({size} bytes exceeds {limit} byte limit)")]
    FileTooLarge { path: String, size: u64, limit: u64 },

    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },

    #[error("Not found: {path}")]
    NotFound { path: String },

    #[error("Operation cancelled")]
    Cancelled,
}
```

All Tauri commands return `Result<T, AppError>`. The `thiserror` crate provides `Display` implementations, and `Serialize` enables JSON serialization to the frontend.

### 9.2 Frontend

- A global error boundary catches unexpected React errors.
- Expected errors (from Tauri commands) are displayed via a toast/notification component.
- File-specific errors (permission denied, not found) are shown inline in the relevant panel.

---

## 10. Project Structure

```
byb/
├── package.json                -- Frontend dependencies, scripts
├── tsconfig.json               -- TypeScript configuration
├── vite.config.ts              -- Vite build configuration
├── index.html                  -- HTML entry point
├── src/                        -- Frontend source (React + TypeScript)
│   ├── app/
│   ├── features/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── lib/
├── src-tauri/                  -- Backend source (Rust)
│   ├── Cargo.toml              -- Rust dependencies
│   ├── tauri.conf.json         -- Tauri configuration
│   ├── build.rs                -- Build script
│   ├── capabilities/
│   │   └── default.json        -- Permissions (fs access, dialogs)
│   ├── icons/                  -- Application icons
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── commands/
│       ├── core/
│       └── utils/
└── docs/
    ├── SPEC.md                 -- This specification document
    └── DESIGN.md               -- This design document
```

---

## 11. Dependencies

### 11.1 Rust (Cargo.toml)

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.x | Application framework |
| `tauri-build` | 2.x | Build support |
| `serde` | 1.x | Serialization/deserialization |
| `serde_json` | 1.x | JSON handling |
| `imara-diff` | latest | Diff algorithm (Histogram + Myers) |
| `walkdir` | 2.x | Recursive directory traversal |
| `sha2` | 0.10.x | SHA-256 content hashing |
| `tokio` | 1.x | Async runtime (Tauri default) |
| `thiserror` | 1.x | Error type derivation |

### 11.2 Frontend (package.json)

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `typescript` | Type safety |
| `@tauri-apps/api` | Tauri frontend API (invoke, events) |
| `@tauri-apps/plugin-dialog` | Native file/directory picker |
| `@codemirror/view` | CodeMirror 6 core view |
| `@codemirror/state` | CodeMirror 6 state management |
| `@codemirror/lang-javascript`, etc. | Syntax highlighting languages |
| `@tanstack/react-virtual` | Virtual scrolling |
| `zustand` | State management |
| `vite` | Build tool |
| `@vitejs/plugin-react` | Vite React plugin |

---

## 12. Testing Strategy

### 12.1 Rust Unit Tests

- **`core::text_diff`**: Test with known file pairs; verify hunk boundaries, change types, and character spans against expected output.
- **`core::dir_diff`**: Test with temporary directory fixtures; verify tree structure, status classification, and aggregate propagation.
- **`core::bin_diff`**: Test with known binary pairs; verify diff ranges.
- **`utils::encoding`**: Test UTF-8 detection with valid, invalid, and edge-case byte sequences.

### 12.2 Rust Integration Tests

- Test Tauri command handlers end-to-end using Tauri's test utilities.
- Verify serialization format of responses matches frontend type expectations.

### 12.3 Frontend Unit Tests

- **Tool**: Vitest + React Testing Library
- Test component rendering with mock data.
- Test hooks with mock Tauri `invoke`.
- Test Zustand stores for correct state transitions.

### 12.4 End-to-End Tests

- **Tool**: Tauri's WebDriver integration (via `tauri-driver`)
- Test full flows: open app → select directories → view comparison → navigate diffs → merge → save.

---

## 13. Traceability Matrix

Maps design components to specification user stories:

| Component / Module | Satisfies |
|--------------------|-----------|
| `core::dir_diff` + `DirCompareView` | US-D1, US-D2, US-D5 |
| `DirTreeNode` double-click handler | US-D3 |
| `file_ops::copy_file` + `DirToolbar` | US-D4 |
| `core::text_diff` + `DiffEditor` + `diff-highlight.ts` | US-T1 |
| `DiffEditor` (CodeMirror editable mode) | US-T2 |
| `TextToolbar` + diff navigation hooks | US-T3 |
| `merge-gutter.ts` + merge handler | US-T4 |
| `file_ops::save_text_file` | US-T5 |
| CodeMirror language extensions | US-T6 |
| `HexView` + `core::bin_diff` | US-B1, US-B2 |
| `BinaryToolbar` + navigation hooks | US-B3 |
| `HomeView` + `PathPicker` | US-G1 |
| `session-store` + `RecentSessions` | US-G2 |
| Keyboard shortcut bindings | US-G3 |
