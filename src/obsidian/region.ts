export interface MessageRegion {
  found: boolean;
  message: string;
  startLine: number;
  endLine: number;
}

const EMPTY: MessageRegion = { found: false, message: "", startLine: -1, endLine: -1 };

export function readMessageRegion(
  text: string,
  marker: string,
  maxRows: number,
): MessageRegion {
  const lines = text.split("\n");
  const markerTrim = marker.trim();

  let markerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === markerTrim) {
      markerIdx = i;
      break;
    }
  }
  if (markerIdx === -1) return EMPTY;

  // Skip blank lines after the marker.
  let start = markerIdx + 1;
  while (start < lines.length && lines[start].trim() === "") start++;
  if (start >= lines.length) return { ...EMPTY, found: true };

  const collected: string[] = [];
  let i = start;
  for (; i < lines.length && collected.length < maxRows; i++) {
    const line = lines[i];
    if (line.trim() === "") break;
    // Stop at an ATX heading (`#`..`######` followed by a space) — but NOT at a
    // line that merely starts with `#`, since `#` is a valid Vestaboard tile
    // (code 39), so e.g. `#SALE` is a legitimate message row.
    if (/^#{1,6}\s/.test(line)) break;
    collected.push(line);
  }

  return {
    found: true,
    message: collected.join("\n"),
    startLine: start,
    endLine: start + collected.length - 1,
  };
}
