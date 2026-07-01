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
    if (line.startsWith("#")) break;
    collected.push(line);
  }

  return {
    found: true,
    message: collected.join("\n"),
    startLine: start,
    endLine: start + collected.length - 1,
  };
}
