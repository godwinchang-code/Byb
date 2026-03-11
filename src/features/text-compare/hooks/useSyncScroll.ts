import { useRef, useCallback } from "react";
import { EditorView } from "@codemirror/view";

/**
 * Hook for synchronized scrolling between two CodeMirror editors.
 * Uses a lock flag to prevent infinite scroll event feedback loops.
 */
export function useSyncScroll() {
  const leftViewRef = useRef<EditorView | null>(null);
  const rightViewRef = useRef<EditorView | null>(null);
  const scrollLockRef = useRef(false);

  const setLeftView = useCallback((view: EditorView | null) => {
    leftViewRef.current = view;
  }, []);

  const setRightView = useCallback((view: EditorView | null) => {
    rightViewRef.current = view;
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (scrollLockRef.current) return;
    const leftView = leftViewRef.current;
    const rightView = rightViewRef.current;
    if (!leftView || !rightView) return;

    scrollLockRef.current = true;
    const scrollTop = leftView.scrollDOM.scrollTop;
    const scrollLeft = leftView.scrollDOM.scrollLeft;
    rightView.scrollDOM.scrollTop = scrollTop;
    rightView.scrollDOM.scrollLeft = scrollLeft;

    requestAnimationFrame(() => {
      scrollLockRef.current = false;
    });
  }, []);

  const handleRightScroll = useCallback(() => {
    if (scrollLockRef.current) return;
    const leftView = leftViewRef.current;
    const rightView = rightViewRef.current;
    if (!leftView || !rightView) return;

    scrollLockRef.current = true;
    const scrollTop = rightView.scrollDOM.scrollTop;
    const scrollLeft = rightView.scrollDOM.scrollLeft;
    leftView.scrollDOM.scrollTop = scrollTop;
    leftView.scrollDOM.scrollLeft = scrollLeft;

    requestAnimationFrame(() => {
      scrollLockRef.current = false;
    });
  }, []);

  /**
   * Scroll both editors to show a specific line.
   */
  const scrollToLine = useCallback((lineNumber: number) => {
    const leftView = leftViewRef.current;
    const rightView = rightViewRef.current;

    const scrollView = (view: EditorView | null) => {
      if (!view) return;
      const line = Math.min(lineNumber + 1, view.state.doc.lines);
      if (line < 1) return;
      const lineInfo = view.state.doc.line(line);
      view.dispatch({
        effects: EditorView.scrollIntoView(lineInfo.from, { y: "center" }),
      });
    };

    scrollLockRef.current = true;
    scrollView(leftView);
    scrollView(rightView);
    requestAnimationFrame(() => {
      scrollLockRef.current = false;
    });
  }, []);

  return {
    setLeftView,
    setRightView,
    handleLeftScroll,
    handleRightScroll,
    scrollToLine,
  };
}
