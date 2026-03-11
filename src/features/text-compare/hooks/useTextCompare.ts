import { useState, useCallback, useRef } from "react";
import { compareTextFiles, compareTextContents, readTextFile, saveTextFile } from "@/lib/tauri-api";
import type { TextDiffResult, DiffHunk } from "../types/text-types";

interface TextCompareState {
  leftContent: string;
  rightContent: string;
  diffResult: TextDiffResult | null;
  loading: boolean;
  error: string | null;
  currentDiffIndex: number;
}

export function useTextCompare(leftPath: string | null, rightPath: string | null) {
  const [state, setState] = useState<TextCompareState>({
    leftContent: "",
    rightContent: "",
    diffResult: null,
    loading: false,
    error: null,
    currentDiffIndex: 0,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial comparison using file paths
  const loadAndCompare = useCallback(async () => {
    if (!leftPath || !rightPath) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [leftContent, rightContent] = await Promise.all([
        readTextFile(leftPath),
        readTextFile(rightPath),
      ]);

      const diffResult = await compareTextFiles(leftPath, rightPath);

      setState({
        leftContent,
        rightContent,
        diffResult,
        loading: false,
        error: null,
        currentDiffIndex: 0,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, [leftPath, rightPath]);

  // Re-compare after content edit (debounced)
  const recompare = useCallback(
    (newLeftContent: string, newRightContent: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const diffResult = await compareTextContents(
            newLeftContent,
            newRightContent,
          );
          setState((prev) => ({
            ...prev,
            diffResult,
            leftContent: newLeftContent,
            rightContent: newRightContent,
          }));
        } catch (e: unknown) {
          console.error("Re-diff failed:", e);
        }
      }, 500);
    },
    [],
  );

  const onLeftEdit = useCallback(
    (newContent: string) => {
      setState((prev) => ({ ...prev, leftContent: newContent }));
      recompare(newContent, state.rightContent);
    },
    [recompare, state.rightContent],
  );

  const onRightEdit = useCallback(
    (newContent: string) => {
      setState((prev) => ({ ...prev, rightContent: newContent }));
      recompare(state.leftContent, newContent);
    },
    [recompare, state.leftContent],
  );

  // Navigation
  const totalDiffs = state.diffResult?.hunks.length ?? 0;

  const goToNextDiff = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentDiffIndex: Math.min(prev.currentDiffIndex + 1, totalDiffs - 1),
    }));
  }, [totalDiffs]);

  const goToPrevDiff = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentDiffIndex: Math.max(prev.currentDiffIndex - 1, 0),
    }));
  }, []);

  // Merge hunk from one side to the other
  const mergeHunk = useCallback(
    (hunkIndex: number, direction: "left-to-right" | "right-to-left") => {
      if (!state.diffResult) return;
      const hunk: DiffHunk = state.diffResult.hunks[hunkIndex];
      if (!hunk) return;

      let newLeftContent = state.leftContent;
      let newRightContent = state.rightContent;

      const leftLines = state.leftContent.split("\n");
      const rightLines = state.rightContent.split("\n");

      if (direction === "left-to-right") {
        // Copy left content to right side at the hunk position
        const sourceLines = leftLines.slice(
          hunk.left_start,
          hunk.left_start + hunk.left_count,
        );
        rightLines.splice(hunk.right_start, hunk.right_count, ...sourceLines);
        newRightContent = rightLines.join("\n");
      } else {
        // Copy right content to left side
        const sourceLines = rightLines.slice(
          hunk.right_start,
          hunk.right_start + hunk.right_count,
        );
        leftLines.splice(hunk.left_start, hunk.left_count, ...sourceLines);
        newLeftContent = leftLines.join("\n");
      }

      setState((prev) => ({
        ...prev,
        leftContent: newLeftContent,
        rightContent: newRightContent,
      }));
      recompare(newLeftContent, newRightContent);
    },
    [state.diffResult, state.leftContent, state.rightContent, recompare],
  );

  // Save
  const saveLeft = useCallback(async () => {
    if (!leftPath) return;
    await saveTextFile(leftPath, state.leftContent);
  }, [leftPath, state.leftContent]);

  const saveRight = useCallback(async () => {
    if (!rightPath) return;
    await saveTextFile(rightPath, state.rightContent);
  }, [rightPath, state.rightContent]);

  return {
    ...state,
    totalDiffs,
    loadAndCompare,
    onLeftEdit,
    onRightEdit,
    goToNextDiff,
    goToPrevDiff,
    mergeHunk,
    saveLeft,
    saveRight,
  };
}
