import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useComparisonStore } from "@/stores/comparison-store";
import { useDirCompare } from "../hooks/useDirCompare";
import DirTreeNode from "./DirTreeNode";
import "./DirCompareView.css";

function DirCompareView() {
  const { leftPath, rightPath } = useComparisonStore();
  const {
    flatTree,
    loading,
    error,
    filterDiffsOnly,
    loadAndCompare,
    toggleExpand,
    toggleFilter,
    openFile,
  } = useDirCompare(leftPath, rightPath);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: flatTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  useEffect(() => {
    loadAndCompare();
  }, [loadAndCompare]);

  if (loading) {
    return (
      <div className="dir-compare-loading">
        <div className="spinner" />
        <span>Comparing directories...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dir-compare-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="dir-compare-view">
      <div className="dir-toolbar">
        <button
          className={filterDiffsOnly ? "active" : ""}
          onClick={toggleFilter}
        >
          {filterDiffsOnly ? "Show All" : "Diffs Only"}
        </button>
        <button onClick={loadAndCompare}>Refresh</button>
        <span className="dir-stats">
          {flatTree.length} items
        </span>
      </div>
      <div className="dir-tree-container" ref={parentRef}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = flatTree[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <DirTreeNode
                  item={item}
                  onToggle={toggleExpand}
                  onDoubleClick={() => openFile(item.node)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DirCompareView;
