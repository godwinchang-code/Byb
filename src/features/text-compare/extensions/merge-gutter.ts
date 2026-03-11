import { gutter } from "@codemirror/view";
import { type Extension } from "@codemirror/state";

// --- Create merge gutter extension ---

export function createMergeGutter(): Extension {
  return gutter({
    class: "cm-merge-gutter",
    lineMarker: () => null,
  });
}
