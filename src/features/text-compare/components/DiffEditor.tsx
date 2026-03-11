import { useEffect, useRef } from "react";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
  lineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState, StateEffect, type Range } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import {
  buildLineMapping,
  diffHighlightTheme,
  type LineMappingEntry,
} from "../extensions/diff-highlight";
import type { DiffHunk, Side } from "../types/text-types";

// --- State effect to push new decorations ---
const setDecorations = StateEffect.define<DecorationSet>();

// --- View plugin that holds diff decorations ---
const diffDecoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    update(update: ViewUpdate) {
      for (const effect of update.transactions.flatMap((t) => t.effects)) {
        if (effect.is(setDecorations)) {
          this.decorations = effect.value;
        }
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

interface DiffEditorProps {
  content: string;
  side: Side;
  hunks: DiffHunk[];
  totalLines: number;
  onContentChange?: (content: string) => void;
  onViewReady?: (view: EditorView) => void;
  onScroll?: () => void;
}

function DiffEditor({
  content,
  side,
  hunks,
  totalLines,
  onContentChange,
  onViewReady,
  onScroll,
}: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onContentChange) {
        const newContent = update.state.doc.toString();
        contentRef.current = newContent;
        onContentChange(newContent);
      }
    });

    const scrollListener = EditorView.domEventHandlers({
      scroll: () => {
        onScroll?.();
        return false;
      },
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        oneDark,
        diffHighlightTheme,
        diffDecoPlugin,
        javascript(), // Default language; can be made dynamic
        updateListener,
        scrollListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    onViewReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only create once

  // Update content when it changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
      contentRef.current = content;
    }
  }, [content]);

  // Update diff decorations when hunks change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const mapping = buildLineMapping(hunks, side, totalLines);
    const decos = buildDecoSet(view, mapping, side);

    view.dispatch({
      effects: setDecorations.of(decos),
    });
  }, [hunks, side, totalLines]);

  return (
    <div
      ref={containerRef}
      className="diff-editor"
      style={{ height: "100%", overflow: "hidden" }}
    />
  );
}

function buildDecoSet(
  view: EditorView,
  mapping: LineMappingEntry[],
  side: Side,
): DecorationSet {
  const insertLineDeco = Decoration.line({ class: "cm-diff-insert-line" });
  const deleteLineDeco = Decoration.line({ class: "cm-diff-delete-line" });
  const modifyLineDeco = Decoration.line({ class: "cm-diff-modify-line" });

  const decos: Range<Decoration>[] = [];
  const doc = view.state.doc;

  for (const entry of mapping) {
    const docLine = entry.lineNumber + 1;
    if (docLine < 1 || docLine > doc.lines) continue;
    const line = doc.line(docLine);

    if (entry.kind === "insert" && side === "right") {
      decos.push(insertLineDeco.range(line.from));
    } else if (entry.kind === "delete" && side === "left") {
      decos.push(deleteLineDeco.range(line.from));
    } else if (entry.kind === "modify") {
      decos.push(modifyLineDeco.range(line.from));

      if (entry.change?.char_diffs) {
        for (const span of entry.change.char_diffs) {
          if (span.side !== side) continue;
          const from = line.from + span.start;
          const to = from + span.length;
          if (from >= line.from && to <= line.to) {
            decos.push(
              Decoration.mark({ class: "cm-diff-char-highlight" }).range(from, to),
            );
          }
        }
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decos);
}

export default DiffEditor;
