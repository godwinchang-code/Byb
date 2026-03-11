import { useState, useCallback, useRef, useEffect } from "react";
import type { BinDiffResult, ByteRange } from "../types/binary-types";
import { compareBinaryFiles, readBinaryChunk } from "@/lib/tauri-api";

const BYTES_PER_ROW = 16;

interface ChunkCache {
  offset: number;
  data: Uint8Array;
}

export function useBinaryCompare(leftPath: string | null, rightPath: string | null) {
  const [diffResult, setDiffResult] = useState<BinDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftData, setLeftData] = useState<Uint8Array>(new Uint8Array(0));
  const [rightData, setRightData] = useState<Uint8Array>(new Uint8Array(0));
  const [visibleOffset, setVisibleOffset] = useState(0);
  const [visibleLength, setVisibleLength] = useState(0);

  const leftCacheRef = useRef<ChunkCache | null>(null);
  const rightCacheRef = useRef<ChunkCache | null>(null);

  const compare = useCallback(async () => {
    if (!leftPath || !rightPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await compareBinaryFiles(leftPath, rightPath);
      setDiffResult(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [leftPath, rightPath]);

  const loadChunk = useCallback(
    async (offset: number, length: number) => {
      if (!leftPath || !rightPath || !diffResult) return;

      // Align to row boundary
      const alignedOffset = Math.floor(offset / BYTES_PER_ROW) * BYTES_PER_ROW;
      // Add prefetch buffer (1 viewport above and below)
      const prefetchOffset = Math.max(0, alignedOffset - length);
      const prefetchLength = length * 3;

      const isCached = (cache: ChunkCache | null) =>
        cache &&
        cache.offset <= alignedOffset &&
        cache.offset + cache.data.length >= alignedOffset + length;

      const tasks: Promise<void>[] = [];

      if (!isCached(leftCacheRef.current)) {
        tasks.push(
          readBinaryChunk(leftPath, prefetchOffset, prefetchLength).then((data) => {
            leftCacheRef.current = { offset: prefetchOffset, data };
          }),
        );
      }

      if (!isCached(rightCacheRef.current)) {
        tasks.push(
          readBinaryChunk(rightPath, prefetchOffset, prefetchLength).then((data) => {
            rightCacheRef.current = { offset: prefetchOffset, data };
          }),
        );
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }

      // Extract visible portion from cache
      const extractVisible = (cache: ChunkCache | null): Uint8Array => {
        if (!cache) return new Uint8Array(0);
        const start = alignedOffset - cache.offset;
        const end = Math.min(start + length, cache.data.length);
        if (start < 0 || start >= cache.data.length) return new Uint8Array(0);
        return cache.data.slice(start, end);
      };

      setLeftData(extractVisible(leftCacheRef.current));
      setRightData(extractVisible(rightCacheRef.current));
      setVisibleOffset(alignedOffset);
      setVisibleLength(length);
    },
    [leftPath, rightPath, diffResult],
  );

  // Check if a byte offset falls within a diff range
  const isDiffByte = useCallback(
    (byteOffset: number): boolean => {
      if (!diffResult) return false;
      return diffResult.diff_ranges.some(
        (r: ByteRange) => byteOffset >= r.offset && byteOffset < r.offset + r.length,
      );
    },
    [diffResult],
  );

  const totalRows = diffResult
    ? Math.ceil(Math.max(diffResult.total_size_left, diffResult.total_size_right) / BYTES_PER_ROW)
    : 0;

  // Current diff index for navigation
  const [currentDiffIdx, setCurrentDiffIdx] = useState(0);

  const diffCount = diffResult?.diff_ranges.length ?? 0;

  const goToNextDiff = useCallback(() => {
    if (!diffResult || diffResult.diff_ranges.length === 0) return -1;
    const next = Math.min(currentDiffIdx + 1, diffResult.diff_ranges.length - 1);
    setCurrentDiffIdx(next);
    return diffResult.diff_ranges[next].offset;
  }, [diffResult, currentDiffIdx]);

  const goToPrevDiff = useCallback(() => {
    if (!diffResult || diffResult.diff_ranges.length === 0) return -1;
    const prev = Math.max(currentDiffIdx - 1, 0);
    setCurrentDiffIdx(prev);
    return diffResult.diff_ranges[prev].offset;
  }, [diffResult, currentDiffIdx]);

  useEffect(() => {
    compare();
  }, [compare]);

  return {
    diffResult,
    loading,
    error,
    leftData,
    rightData,
    visibleOffset,
    visibleLength,
    totalRows,
    loadChunk,
    isDiffByte,
    compare,
    currentDiffIdx,
    diffCount,
    goToNextDiff,
    goToPrevDiff,
  };
}
