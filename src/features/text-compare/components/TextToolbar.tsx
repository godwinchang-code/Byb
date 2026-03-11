import "./TextToolbar.css";

interface TextToolbarProps {
  currentDiff: number;
  totalDiffs: number;
  onPrevDiff: () => void;
  onNextDiff: () => void;
  onSaveLeft: () => void;
  onSaveRight: () => void;
  onMergeLeftToRight: () => void;
  onMergeRightToLeft: () => void;
}

function TextToolbar({
  currentDiff,
  totalDiffs,
  onPrevDiff,
  onNextDiff,
  onSaveLeft,
  onSaveRight,
  onMergeLeftToRight,
  onMergeRightToLeft,
}: TextToolbarProps) {
  return (
    <div className="text-toolbar">
      <div className="text-toolbar-group">
        <button onClick={onSaveLeft} title="Save Left (Ctrl+S)">
          Save L
        </button>
        <button onClick={onMergeRightToLeft} title="Copy current diff from right to left">
          ← Merge
        </button>
      </div>

      <div className="text-toolbar-center">
        <button
          onClick={onPrevDiff}
          disabled={currentDiff <= 0}
          title="Previous Diff (Alt+Up)"
        >
          ▲ Prev
        </button>
        <span className="diff-indicator">
          {totalDiffs > 0
            ? `${currentDiff + 1} / ${totalDiffs}`
            : "No diffs"}
        </span>
        <button
          onClick={onNextDiff}
          disabled={currentDiff >= totalDiffs - 1}
          title="Next Diff (Alt+Down)"
        >
          Next ▼
        </button>
      </div>

      <div className="text-toolbar-group">
        <button onClick={onMergeLeftToRight} title="Copy current diff from left to right">
          Merge →
        </button>
        <button onClick={onSaveRight} title="Save Right">
          Save R
        </button>
      </div>
    </div>
  );
}

export default TextToolbar;
