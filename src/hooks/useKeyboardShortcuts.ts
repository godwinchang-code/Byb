import { useEffect } from "react";
import { useComparisonStore } from "@/stores/comparison-store";

export function useKeyboardShortcuts() {
  const { view, goHome } = useComparisonStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Escape: go home from any compare view
      if (e.key === "Escape" && view !== "home") {
        e.preventDefault();
        goHome();
        return;
      }

      // Ctrl+S: save (handled by text compare view itself)
      // F5 or Ctrl+R: refresh
      if (e.key === "F5" || (mod && e.key === "r")) {
        // Let the active compare view handle this
        return;
      }

      // Alt+Up / Alt+Down: navigate diffs (dispatch custom events for views to handle)
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("byb:navigate-diff", {
            detail: { direction: e.key === "ArrowDown" ? "next" : "prev" },
          }),
        );
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, goHome]);
}
