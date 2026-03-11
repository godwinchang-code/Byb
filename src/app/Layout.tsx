import { type ReactNode } from "react";
import { useComparisonStore } from "@/stores/comparison-store";
import "./Layout.css";

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const { view, leftPath, rightPath, currentDiffIndex, totalDiffs, goHome } =
    useComparisonStore();

  return (
    <div className="layout">
      <div className="toolbar">
        <div className="toolbar-left">
          {view !== "home" && (
            <button onClick={goHome} title="Back to Home">
              ← Home
            </button>
          )}
          <span className="toolbar-title">byb</span>
        </div>
        <div className="toolbar-center">
          {view !== "home" && totalDiffs > 0 && (
            <span className="diff-counter">
              Diff {currentDiffIndex + 1} of {totalDiffs}
            </span>
          )}
        </div>
        <div className="toolbar-right">
          {view !== "home" && (
            <>
              <span className="path-label" title={leftPath ?? ""}>
                {leftPath ? truncatePath(leftPath) : "—"}
              </span>
              <span className="path-separator">↔</span>
              <span className="path-label" title={rightPath ?? ""}>
                {rightPath ? truncatePath(rightPath) : "—"}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="content">{children}</div>
      <div className="statusbar">
        <span>
          {view === "home"
            ? "Ready"
            : `${view.replace("-", " ")} | ${leftPath ?? ""} ↔ ${rightPath ?? ""}`}
        </span>
      </div>
    </div>
  );
}

function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  return "..." + path.slice(-maxLen + 3);
}

export default Layout;
