import { invoke } from "@tauri-apps/api/core";
import type { TextDiffResult } from "@/features/text-compare/types/text-types";
import type { DirNode, DirCmpOptions } from "@/features/dir-compare/types/dir-types";
import type { BinDiffResult } from "@/features/binary-compare/types/binary-types";

export async function compareTextFiles(
  left: string,
  right: string,
): Promise<TextDiffResult> {
  return invoke<TextDiffResult>("compare_text_files", { left, right });
}

export async function compareTextContents(
  leftContent: string,
  rightContent: string,
): Promise<TextDiffResult> {
  return invoke<TextDiffResult>("compare_text_contents", {
    leftContent,
    rightContent,
  });
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function saveTextFile(
  path: string,
  content: string,
): Promise<void> {
  return invoke<void>("save_text_file", { path, content });
}

export async function copyFile(src: string, dest: string): Promise<void> {
  return invoke<void>("copy_file", { src, dest });
}

export async function checkIsTextFile(path: string): Promise<boolean> {
  return invoke<boolean>("check_is_text_file", { path });
}

export async function compareDirs(
  left: string,
  right: string,
  options: DirCmpOptions,
): Promise<DirNode> {
  return invoke<DirNode>("compare_dirs", { left, right, options });
}

export async function compareBinaryFiles(
  left: string,
  right: string,
): Promise<BinDiffResult> {
  return invoke<BinDiffResult>("compare_binary_files", { left, right });
}

export async function readBinaryChunk(
  path: string,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  const data = await invoke<number[]>("read_binary_chunk", { path, offset, length });
  return new Uint8Array(data);
}
