import { useState, useCallback } from "react";
import { useComparisonStore } from "@/stores/comparison-store";
import { useBinaryCompare } from "../hooks/useBinaryCompare";
import HexView from "./HexView";
import "./BinaryCompareView.css";

function BinaryCompareView() {
  const { leftPath, rightPath } = useComparisonStore();
  const {
    diffResult,
    loading,
    error,
    leftData,
    rightData,
    visibleOffset,
    totalRows,
    loadChunk,
    isDiffByte,
    compare,
    currentDiffIdx,
    diffCount,
    goToNextDiff,
    goToPrevDiff,
  } = useBinaryCompare(leftPath, rightPath);

  const [scrollToOffset, setScrollToOffset] = useState<number | undefined>(undefined);

  const handleNextDiff = useCallback(() => {
    const offset = goToNextDiff();
    if (offset >= 0) setScrollToOffset(offset);
  }, [goToNextDiff]);

  const handlePrevDiff = useCallback(() => {
    const offset = goToPrevDiff();
    if (offset >= 0) setScrollToOffset(offset);
  }, [goToPrevDiff]);

  if (loading) {
    return (
      <div className="bin-compare-loading">
        <div className="spinner" />
        <span>Comparing binary files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bin-compare-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="bin-compare-view">
      <div className="bin-toolbar">
        <button onClick={handlePrevDiff} disabled={diffCount === 0}>
          Prev
        </button>
        <button onClick={handleNextDiff} disabled={diffCount === 0}>
          Next
        </button>
        <span className="bin-nav-info">
          {diffCount > 0
            ? `${currentDiffIdx + 1} / ${diffCount} differences`
            : "No differences"}
        </span>
        <button onClick={compare}>Refresh</button>
        <span className="bin-stats">
          L: {formatSize(diffResult?.total_size_left ?? 0)} | R:{" "}
          {formatSize(diffResult?.total_size_right ?? 0)}
        </span>
      </div>
      <div className="bin-panels">
        <div className="bin-panel">
          <div className="bin-panel-header">Left</div>
          <HexView
            totalRows={totalRows}
            totalSize={diffResult?.total_size_left ?? 0}
            data={leftData}
            visibleOffset={visibleOffset}
            onRangeChange={loadChunk}
            isDiffByte={isDiffByte}
            scrollToOffset={scrollToOffset}
          />
        </div>
        <div className="bin-panel">
          <div className="bin-panel-header">Right</div>
          <HexView
            totalRows={totalRows}
            totalSize={diffResult?.total_size_right ?? 0}
            data={rightData}
            visibleOffset={visibleOffset}
            onRangeChange={loadChunk}
            isDiffByte={isDiffByte}
            scrollToOffset={scrollToOffset}
          />
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default BinaryCompareView;
