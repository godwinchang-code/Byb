export type FileStatus = "left_only" | "right_only" | "modified" | "identical";
export type NodeType = "file" | "directory";

export interface DirNode {
  name: string;
  relative_path: string;
  node_type: NodeType;
  status: FileStatus;
  size_left: number | null;
  size_right: number | null;
  modified_left: number | null;
  modified_right: number | null;
  children: DirNode[] | null;
}

export interface DirCmpOptions {
  quick: boolean;
}

export interface FlatTreeNode {
  node: DirNode;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
}
