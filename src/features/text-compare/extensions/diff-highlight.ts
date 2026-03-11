import {
  Decoration,
  type DecorationSet,
  EditorView,
} from "@codemirror/view";
import { type Range } from "@codemirror/state";
import type {
  DiffHunk,
  LineChange,
  Side,
} from "@/features/text-compare/types/text-types";

// --- Line Decorations ---

const insertLineDeco = Decoration.line({ class: "cm-diff-insert-line" });
const deleteLineDeco = Decoration.line({ class: "cm-diff-delete-line" });
const modifyLineDeco = Decoration.line({ class: "cm-diff-modify-line" });

// --- Build line mapping from hunks ---

export interface LineMappingEntry {
  lineNumber: number; // 0-based line number in the editor content
  kind: "equal" | "insert" | "delete" | "modify";
  change?: LineChange;
}

/**
 * Build a complete line mapping for one side of a diff.
 * This maps each line in the editor to its diff status.
 */
export function buildLineMapping(
  hunks: DiffHunk[],
  side: Side,
  totalLines: number,
): LineMappingEntry[] {
  const mapping: LineMappingEntry[] = [];
  let currentLine = 0;

  for (const hunk of hunks) {
    const hunkStart = side === "left" ? hunk.left_start : hunk.right_start;

    // Equal lines before this hunk
    while (currentLine < hunkStart && currentLine < totalLines) {
      mapping.push({ lineNumber: currentLine, kind: "equal" });
      currentLine++;
    }

    // Changed lines in this hunk
    for (const change of hunk.changes) {
      if (change.kind === "equal") {
        mapping.push({ lineNumber: currentLine, kind: "equal" });
        currentLine++;
      } else if (change.kind === "insert") {
        if (side === "right") {
          mapping.push({ lineNumber: currentLine, kind: "insert", change });
          currentLine++;
        }
      } else if (change.kind === "delete") {
        if (side === "left") {
          mapping.push({ lineNumber: currentLine, kind: "delete", change });
          currentLine++;
        }
      } else if (change.kind === "modify") {
        mapping.push({ lineNumber: currentLine, kind: "modify", change });
        currentLine++;
      }
    }
  }

  // Remaining equal lines
  while (currentLine < totalLines) {
    mapping.push({ lineNumber: currentLine, kind: "equal" });
    currentLine++;
  }

  return mapping;
}

// --- Decoration builder using line mapping ---

export function buildDecorationsFromMapping(
  view: EditorView,
  mapping: LineMappingEntry[],
  side: Side,
): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const doc = view.state.doc;

  for (const entry of mapping) {
    const docLine = entry.lineNumber + 1; // 1-based
    if (docLine < 1 || docLine > doc.lines) continue;

    const line = doc.line(docLine);

    if (entry.kind === "insert" && side === "right") {
      decos.push(insertLineDeco.range(line.from));
    } else if (entry.kind === "delete" && side === "left") {
      decos.push(deleteLineDeco.range(line.from));
    } else if (entry.kind === "modify") {
      decos.push(modifyLineDeco.range(line.from));

      // Character-level highlights
      if (entry.change?.char_diffs) {
        for (const span of entry.change.char_diffs) {
          if (span.side !== side) continue;
          const from = line.from + span.start;
          const to = from + span.length;
          if (from >= line.from && to <= line.to) {
            decos.push(
              Decoration.mark({ class: "cm-diff-char-highlight" }).range(
                from,
                to,
              ),
            );
          }
        }
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decos);
}

// --- Theme ---

export const diffHighlightTheme = EditorView.baseTheme({
  ".cm-diff-insert-line": {
    backgroundColor: "var(--diff-insert-bg)",
  },
  ".cm-diff-delete-line": {
    backgroundColor: "var(--diff-delete-bg)",
  },
  ".cm-diff-modify-line": {
    backgroundColor: "var(--diff-modify-bg)",
  },
  ".cm-diff-char-highlight": {
    backgroundColor: "rgba(255, 200, 50, 0.35)",
    borderRadius: "2px",
  },
  ".cm-diff-phantom": {
    backgroundColor: "var(--bg-tertiary)",
    borderTop: "1px dashed var(--border-color)",
    borderBottom: "1px dashed var(--border-color)",
  },
});
