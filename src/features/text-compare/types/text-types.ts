export type Side = "left" | "right";

export type ChangeKind = "equal" | "insert" | "delete" | "modify";

export interface CharSpan {
  side: Side;
  start: number;
  length: number;
}

export interface LineChange {
  kind: ChangeKind;
  left_line: string | null;
  right_line: string | null;
  char_diffs: CharSpan[] | null;
}

export interface DiffHunk {
  left_start: number;
  left_count: number;
  right_start: number;
  right_count: number;
  changes: LineChange[];
}

export interface TextDiffResult {
  hunks: DiffHunk[];
  left_line_count: number;
  right_line_count: number;
  left_encoding: string;
  right_encoding: string;
}
