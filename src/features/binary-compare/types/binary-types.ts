export interface ByteRange {
  offset: number;
  length: number;
}

export interface BinDiffResult {
  diff_ranges: ByteRange[];
  total_size_left: number;
  total_size_right: number;
}
