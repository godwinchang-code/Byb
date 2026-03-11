import { create } from "zustand";

export type ViewType =
  | "home"
  | "dir-compare"
  | "text-compare"
  | "binary-compare";

interface ComparisonState {
  view: ViewType;
  leftPath: string | null;
  rightPath: string | null;
  currentDiffIndex: number;
  totalDiffs: number;

  setView: (view: ViewType) => void;
  setPaths: (left: string | null, right: string | null) => void;
  setLeftPath: (path: string | null) => void;
  setRightPath: (path: string | null) => void;
  setDiffNavigation: (current: number, total: number) => void;
  goHome: () => void;
}

export const useComparisonStore = create<ComparisonState>((set) => ({
  view: "home",
  leftPath: null,
  rightPath: null,
  currentDiffIndex: 0,
  totalDiffs: 0,

  setView: (view) => set({ view }),
  setPaths: (left, right) => set({ leftPath: left, rightPath: right }),
  setLeftPath: (path) => set({ leftPath: path }),
  setRightPath: (path) => set({ rightPath: path }),
  setDiffNavigation: (current, total) =>
    set({ currentDiffIndex: current, totalDiffs: total }),
  goHome: () =>
    set({
      view: "home",
      leftPath: null,
      rightPath: null,
      currentDiffIndex: 0,
      totalDiffs: 0,
    }),
}));
