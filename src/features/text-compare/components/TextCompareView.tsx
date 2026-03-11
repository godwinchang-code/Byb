import { useEffect } from "react";
import { useComparisonStore } from "@/stores/comparison-store";
import SplitPane from "@/components/SplitPane";
import DiffEditor from "./DiffEditor";
import TextToolbar from "./TextToolbar";
import { useTextCompare } from "../hooks/useTextCompare";
import { useSyncScroll } from "../hooks/useSyncScroll";
import "./TextCompareView.css";

function TextCompareView() {
  const { leftPath, rightPath, setDiffNavigation } = useComparisonStore();

  const {
    leftContent,
    rightContent,
    diffResult,
    loading,
    error,
    currentDiffIndex,
    totalDiffs,
    loadAndCompare,
    onLeftEdit,
    onRightEdit,
    goToNextDiff,
    goToPrevDiff,
    mergeHunk,
    saveLeft,
    saveRight,
  } = useTextCompare(leftPath, rightPath);

  const {
    setLeftView,
    setRightView,
    handleLeftScroll,
    handleRightScroll,
    scrollToLine,
  } = useSyncScroll();

  // Load and compare on mount
  useEffect(() => {
    loadAndCompare();
  }, [loadAndCompare]);

  // Update global diff navigation state
  useEffect(() => {
    setDiffNavigation(currentDiffIndex, totalDiffs);
  }, [currentDiffIndex, totalDiffs, setDiffNavigation]);

  // Scroll to current diff
  useEffect(() => {
    if (diffResult && diffResult.hunks.length > 0 && currentDiffIndex >= 0) {
      const hunk = diffResult.hunks[currentDiffIndex];
      if (hunk) {
        scrollToLine(hunk.left_start);
      }
    }
  }, [currentDiffIndex, diffResult, scrollToLine]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        goToNextDiff();
      } else if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        goToPrevDiff();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        // Save the focused side
        saveLeft();
        saveRight();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextDiff, goToPrevDiff, saveLeft, saveRight]);

  if (loading) {
    return (
      <div className="text-compare-loading">
        <div className="spinner" />
        <span>Computing diff...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-compare-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  const hunks = diffResult?.hunks ?? [];

  return (
    <div className="text-compare-view">
      <TextToolbar
        currentDiff={currentDiffIndex}
        totalDiffs={totalDiffs}
        onPrevDiff={goToPrevDiff}
        onNextDiff={goToNextDiff}
        onSaveLeft={saveLeft}
        onSaveRight={saveRight}
        onMergeLeftToRight={() => mergeHunk(currentDiffIndex, "left-to-right")}
        onMergeRightToLeft={() => mergeHunk(currentDiffIndex, "right-to-left")}
      />
      <div className="text-compare-editors">
        <SplitPane
          left={
            <DiffEditor
              content={leftContent}
              side="left"
              hunks={hunks}
              totalLines={diffResult?.left_line_count ?? 0}
              onContentChange={onLeftEdit}
              onViewReady={setLeftView}
              onScroll={handleLeftScroll}
            />
          }
          right={
            <DiffEditor
              content={rightContent}
              side="right"
              hunks={hunks}
              totalLines={diffResult?.right_line_count ?? 0}
              onContentChange={onRightEdit}
              onViewReady={setRightView}
              onScroll={handleRightScroll}
            />
          }
        />
      </div>
    </div>
  );
}

export default TextCompareView;
