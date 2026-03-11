# byb — Beyond Your Beyond

A modern, open-source, cross-platform file and directory comparison tool. Inspired by Beyond Compare, built with Rust + Tauri 2 + React + TypeScript.

## Features

### Directory Comparison
- Recursive tree view comparing two directory trees
- File status indicators: added, removed, modified, identical
- Filter to show only differences
- Copy files from one side to the other
- Virtual scrolling for large directory trees

### Text File Comparison
- Line-level diff with inline character-level change highlighting
- Bidirectional editing — edit either side directly
- Merge individual diff hunks from one side to the other
- Syntax highlighting (JavaScript, Python, Rust, Java, C++, CSS, HTML, JSON, XML, Markdown)
- Synchronized scrolling between panels
- Diff navigation (next/previous difference)

### Binary File Comparison
- Hex dump view: offset / hex bytes / ASCII
- Byte-level difference highlighting
- Virtual scrolling for large files (chunked loading)
- Diff navigation between byte ranges

### General
- Native file picker and drag-and-drop support
- Session persistence — remembers recent comparisons across restarts
- Keyboard shortcuts (Escape to go home, Alt+Up/Down to navigate diffs)
- Cross-platform: Windows 10+, macOS 12+, Linux

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust |
| Framework | Tauri 2 |
| Frontend | React + TypeScript |
| Editor | CodeMirror 6 |
| Diff Algorithm | imara-diff (Histogram) |
| State Management | Zustand |
| Virtual Scrolling | @tanstack/react-virtual |

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- System dependencies for Tauri 2 (see below)

### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Linux (Fedora)

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libxdo-devel libappindicator-gtk3-devel librsvg2-devel
```

### Linux (Arch)

```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

### macOS

```bash
xcode-select --install
```

### Windows

- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11)

## Getting Started

### Clone and install dependencies

```bash
git clone https://github.com/user/byb.git
cd byb
npm install
```

### Development

```bash
npm run tauri dev
```

This starts the Vite dev server and launches the Tauri window with hot-reload.

### Build

```bash
npm run tauri build
```

The built application can be found in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| Linux | `.deb`, `.AppImage` |
| macOS | `.dmg`, `.app` |
| Windows | `.msi`, `.exe` |

### Run Tests (Rust)

```bash
cd src-tauri
cargo test
```

## Project Structure

```
byb/
├── src/                          # React/TypeScript frontend
│   ├── app/                      # App root, Layout
│   ├── features/
│   │   ├── home/                 # Welcome screen, recent sessions
│   │   ├── text-compare/         # Text diff view (CodeMirror 6)
│   │   ├── dir-compare/          # Directory tree comparison
│   │   └── binary-compare/       # Hex view comparison
│   ├── stores/                   # Zustand state management
│   ├── hooks/                    # Shared hooks (keyboard shortcuts)
│   └── lib/                      # Tauri API wrappers
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── commands/             # Tauri IPC command handlers
│       ├── core/                 # Diff algorithms (text, dir, binary)
│       └── utils/                # Encoding detection, helpers
├── docs/                         # Specification & design documents
├── package.json
└── index.html
```

## License

MIT
