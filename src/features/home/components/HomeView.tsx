import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useComparisonStore } from "@/stores/comparison-store";
import { useSessionStore } from "@/stores/session-store";
import RecentSessions from "./RecentSessions";
import "./HomeView.css";

function HomeView() {
  const { setView, setLeftPath, setRightPath, leftPath, rightPath } =
    useComparisonStore();
  const { addSession } = useSessionStore();
  const [greeting, setGreeting] = useState("");
  const [compareMode, setCompareMode] = useState<"file" | "dir">("file");
  const [dropHighlight, setDropHighlight] = useState<"left" | "right" | null>(null);

  // Handle file drag-and-drop
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          // Determine which side based on cursor position
          const x = event.payload.position.x;
          const windowWidth = window.innerWidth;
          setDropHighlight(x < windowWidth / 2 ? "left" : "right");
        } else if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length > 0) {
            const side = dropHighlight ?? "left";
            const path = paths[0];
            if (side === "left") setLeftPath(path);
            else setRightPath(path);
          }
          setDropHighlight(null);
        } else if (event.payload.type === "leave") {
          setDropHighlight(null);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, [dropHighlight, setLeftPath, setRightPath]);

  const handleBrowse = async (side: "left" | "right", mode: "dir" | "file") => {
    try {
      setCompareMode(mode);
      if (mode === "dir") {
        const selected = await open({ directory: true, multiple: false });
        if (selected) {
          if (side === "left") setLeftPath(selected as string);
          else setRightPath(selected as string);
        }
      } else {
        const selected = await open({ multiple: false });
        if (selected) {
          if (side === "left") setLeftPath(selected as string);
          else setRightPath(selected as string);
        }
      }
    } catch (e) {
      console.error("Browse error:", e);
    }
  };

  const handleCompare = async () => {
    if (!leftPath || !rightPath) return;
    const type = compareMode === "dir" ? "directory" : "file";
    addSession(leftPath, rightPath, type);
    setView(compareMode === "dir" ? "dir-compare" : "text-compare");
  };

  const handleGreetTest = async () => {
    try {
      const result = await invoke<string>("greet", { name: "byb user" });
      setGreeting(result);
    } catch (e) {
      console.error("Greet error:", e);
    }
  };

  return (
    <div className="home-view">
      <div className="home-header">
        <h1 className="home-title">byb</h1>
        <p className="home-subtitle">Beyond Your Beyond — File Comparison Tool</p>
      </div>

      <div className="home-panels">
        <div className={`home-panel${dropHighlight === "left" ? " drop-active" : ""}`}>
          <label className="panel-label">Left</label>
          <div className="path-input-row">
            <input
              type="text"
              className="path-input"
              placeholder="Select a file or directory..."
              value={leftPath ?? ""}
              onChange={(e) => setLeftPath(e.target.value || null)}
              readOnly
            />
            <button onClick={() => handleBrowse("left", "file")}>File</button>
            <button onClick={() => handleBrowse("left", "dir")}>Dir</button>
          </div>
        </div>

        <div className={`home-panel${dropHighlight === "right" ? " drop-active" : ""}`}>
          <label className="panel-label">Right</label>
          <div className="path-input-row">
            <input
              type="text"
              className="path-input"
              placeholder="Select a file or directory..."
              value={rightPath ?? ""}
              onChange={(e) => setRightPath(e.target.value || null)}
              readOnly
            />
            <button onClick={() => handleBrowse("right", "file")}>File</button>
            <button onClick={() => handleBrowse("right", "dir")}>Dir</button>
          </div>
        </div>
      </div>

      <div className="home-actions">
        <span className="mode-label">
          Mode: {compareMode === "dir" ? "Directory" : "File"}
        </span>
        <button
          className="primary compare-btn"
          onClick={handleCompare}
          disabled={!leftPath || !rightPath}
        >
          Compare
        </button>
      </div>

      <RecentSessions />

      {/* Scaffold verification — will be removed */}
      <div className="home-debug">
        <button onClick={handleGreetTest}>Test Rust Connection</button>
        {greeting && <p className="greeting-result">{greeting}</p>}
      </div>
    </div>
  );
}

export default HomeView;
