export interface MessageRegion {
  found: boolean;
  message: string;
}

const EMPTY: MessageRegion = { found: false, message: "" };

const FENCE = /^\s*(```|~~~)/;

export function readMessageRegion(
  text: string,
  marker: string,
  maxRows: number,
): MessageRegion {
  const lines = text.split("\n");
  const markerTrim = marker.trim();

  // Find the marker heading, ignoring occurrences inside fenced code blocks
  // (e.g. a note that documents the plugin and quotes "## Vestaboard").
  let inFence = false;
  let markerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && lines[i].trim() === markerTrim) {
      markerIdx = i;
      break;
    }
  }
  if (markerIdx === -1) return EMPTY;

  // Skip blank lines after the marker.
  let start = markerIdx + 1;
  while (start < lines.length && lines[start].trim() === "") start++;
  if (start >= lines.length) return { found: true, message: "" };

  const collected: string[] = [];
  for (let i = start; i < lines.length && collected.length < maxRows; i++) {
    const line = lines[i];
    if (line.trim() === "") break;
    // Stop at an ATX heading (`#`..`######` followed by a space) — but NOT at a
    // line that merely starts with `#`, since `#` is a valid Vestaboard tile
    // (code 39), so e.g. `#SALE` is a legitimate message row.
    if (/^#{1,6}\s/.test(line)) break;
    collected.push(line);
  }

  return { found: true, message: collected.join("\n") };
}
