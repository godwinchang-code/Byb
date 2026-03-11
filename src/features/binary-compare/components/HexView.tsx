import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import HexRow from "./HexRow";

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 20;

interface HexViewProps {
  totalRows: number;
  totalSize: number;
  data: Uint8Array;
  visibleOffset: number;
  onRangeChange: (offset: number, length: number) => void;
  isDiffByte: (offset: number) => boolean;
  scrollToOffset?: number;
}

function HexView({
  totalRows,
  totalSize,
  data,
  visibleOffset,
  onRangeChange,
  isDiffByte,
  scrollToOffset,
}: HexViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // Load data when visible range changes
  const items = virtualizer.getVirtualItems();
  const rangeRef = useRef({ start: -1, end: -1 });

  useEffect(() => {
    if (items.length === 0) return;
    const startRow = items[0].index;
    const endRow = items[items.length - 1].index;

    if (startRow === rangeRef.current.start && endRow === rangeRef.current.end) return;
    rangeRef.current = { start: startRow, end: endRow };

    const offset = startRow * BYTES_PER_ROW;
    const length = (endRow - startRow + 1) * BYTES_PER_ROW;
    onRangeChange(offset, length);
  }, [items, onRangeChange]);

  // Scroll to offset when requested
  useEffect(() => {
    if (scrollToOffset !== undefined && scrollToOffset >= 0) {
      const row = Math.floor(scrollToOffset / BYTES_PER_ROW);
      virtualizer.scrollToIndex(row, { align: "center" });
    }
  }, [scrollToOffset, virtualizer]);

  const getRowBytes = useCallback(
    (rowIndex: number): Uint8Array => {
      const rowOffset = rowIndex * BYTES_PER_ROW;
      const startInData = rowOffset - visibleOffset;
      if (startInData < 0 || startInData >= data.length) {
        return new Uint8Array(0);
      }
      const endInData = Math.min(startInData + BYTES_PER_ROW, data.length);
      // Clamp to actual file size
      const maxBytes = Math.max(0, totalSize - rowOffset);
      const sliceEnd = Math.min(endInData, startInData + maxBytes);
      return data.slice(startInData, sliceEnd);
    },
    [data, visibleOffset, totalSize],
  );

  return (
    <div className="hex-view" ref={parentRef}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <HexRow
              offset={virtualItem.index * BYTES_PER_ROW}
              bytes={getRowBytes(virtualItem.index)}
              isDiffByte={isDiffByte}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default HexView;
