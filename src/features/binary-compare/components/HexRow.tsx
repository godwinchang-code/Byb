interface HexRowProps {
  offset: number;
  bytes: Uint8Array;
  isDiffByte: (offset: number) => boolean;
}

function HexRow({ offset, bytes, isDiffByte }: HexRowProps) {
  const hexCells: React.ReactNode[] = [];
  const asciiCells: React.ReactNode[] = [];

  for (let i = 0; i < 16; i++) {
    const byteOffset = offset + i;
    const hasByte = i < bytes.length;
    const isDiff = hasByte && isDiffByte(byteOffset);

    if (hasByte) {
      const byte = bytes[i];
      hexCells.push(
        <span key={i} className={`hex-byte${isDiff ? " hex-diff" : ""}`}>
          {byte.toString(16).padStart(2, "0")}
        </span>,
      );
      // Printable ASCII range: 0x20 - 0x7E
      const ch = byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
      asciiCells.push(
        <span key={i} className={`ascii-char${isDiff ? " hex-diff" : ""}`}>
          {ch}
        </span>,
      );
    } else {
      hexCells.push(
        <span key={i} className="hex-byte hex-empty">
          {"  "}
        </span>,
      );
      asciiCells.push(
        <span key={i} className="ascii-char hex-empty">
          {" "}
        </span>,
      );
    }

    // Add separator after 8 bytes
    if (i === 7) {
      hexCells.push(
        <span key="sep" className="hex-separator">
          {" "}
        </span>,
      );
    }
  }

  return (
    <div className="hex-row">
      <span className="hex-offset">{offset.toString(16).padStart(8, "0")}</span>
      <span className="hex-bytes">{hexCells}</span>
      <span className="hex-ascii">{asciiCells}</span>
    </div>
  );
}

export default HexRow;
