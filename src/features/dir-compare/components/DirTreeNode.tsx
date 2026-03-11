import type { FlatTreeNode } from "../types/dir-types";
import "./DirTreeNode.css";

interface DirTreeNodeProps {
  item: FlatTreeNode;
  onToggle: (path: string) => void;
  onDoubleClick: () => void;
}

function DirTreeNode({ item, onToggle, onDoubleClick }: DirTreeNodeProps) {
  const { node, depth, expanded, hasChildren } = item;
  const indent = depth * 20;

  const statusClass = `status-${node.status}`;
  const icon =
    node.node_type === "directory"
      ? expanded
        ? "▼"
        : "▶"
      : "·";

  const statusLabel = getStatusLabel(node.status);

  return (
    <div
      className={`dir-tree-node ${statusClass}`}
      style={{ paddingLeft: `${indent + 8}px` }}
      onDoubleClick={node.node_type === "file" ? onDoubleClick : undefined}
    >
      <span
        className={`node-icon ${hasChildren ? "clickable" : ""}`}
        onClick={hasChildren ? () => onToggle(node.relative_path) : undefined}
      >
        {icon}
      </span>
      <span className="node-name">{node.name}</span>
      <span className={`node-status ${statusClass}`}>{statusLabel}</span>
      {node.size_left != null && (
        <span className="node-size">{formatSize(node.size_left)}</span>
      )}
      {node.size_right != null && (
        <span className="node-size">{formatSize(node.size_right)}</span>
      )}
    </div>
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "left_only":
      return "L";
    case "right_only":
      return "R";
    case "modified":
      return "M";
    case "identical":
      return "=";
    default:
      return "?";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export default DirTreeNode;
