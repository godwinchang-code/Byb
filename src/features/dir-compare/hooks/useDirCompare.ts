import { useState, useCallback, useMemo } from "react";
import { compareDirs, checkIsTextFile } from "@/lib/tauri-api";
import { useComparisonStore } from "@/stores/comparison-store";
import type { DirNode, FlatTreeNode } from "../types/dir-types";

interface DirCompareState {
  tree: DirNode | null;
  loading: boolean;
  error: string | null;
  expandedPaths: Set<string>;
  filterDiffsOnly: boolean;
}

export function useDirCompare(leftPath: string | null, rightPath: string | null) {
  const [state, setState] = useState<DirCompareState>({
    tree: null,
    loading: false,
    error: null,
    expandedPaths: new Set(),
    filterDiffsOnly: false,
  });

  const { setPaths, setView } = useComparisonStore();

  const loadAndCompare = useCallback(async () => {
    if (!leftPath || !rightPath) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const tree = await compareDirs(leftPath, rightPath, { quick: false });
      // Auto-expand root
      const expandedPaths = new Set<string>([""]);
      setState({
        tree,
        loading: false,
        error: null,
        expandedPaths,
        filterDiffsOnly: false,
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

  const toggleExpand = useCallback((path: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { ...prev, expandedPaths: newExpanded };
    });
  }, []);

  const toggleFilter = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filterDiffsOnly: !prev.filterDiffsOnly,
    }));
  }, []);

  // Flatten tree for virtual scrolling
  const flatTree = useMemo<FlatTreeNode[]>(() => {
    if (!state.tree) return [];

    const result: FlatTreeNode[] = [];
    const flatten = (node: DirNode, depth: number) => {
      // Skip if filtering and this is identical
      if (state.filterDiffsOnly && node.status === "identical") return;

      const hasChildren = !!node.children && node.children.length > 0;
      const expanded = state.expandedPaths.has(node.relative_path);

      result.push({ node, depth, expanded, hasChildren });

      if (expanded && node.children) {
        for (const child of node.children) {
          flatten(child, depth + 1);
        }
      }
    };

    // Flatten children of root (don't show root itself)
    if (state.tree.children) {
      for (const child of state.tree.children) {
        flatten(child, 0);
      }
    }

    return result;
  }, [state.tree, state.expandedPaths, state.filterDiffsOnly]);

  // Open a file for comparison
  const openFile = useCallback(
    async (node: DirNode) => {
      if (node.node_type !== "file" || !leftPath || !rightPath) return;

      const leftFilePath = `${leftPath}/${node.relative_path}`;
      const rightFilePath = `${rightPath}/${node.relative_path}`;

      setPaths(leftFilePath, rightFilePath);

      // Determine if text or binary
      try {
        const isText = await checkIsTextFile(
          node.status === "right_only" ? rightFilePath : leftFilePath,
        );
        setView(isText ? "text-compare" : "binary-compare");
      } catch {
        setView("text-compare"); // Default to text
      }
    },
    [leftPath, rightPath, setPaths, setView],
  );

  return {
    ...state,
    flatTree,
    loadAndCompare,
    toggleExpand,
    toggleFilter,
    openFile,
  };
}
