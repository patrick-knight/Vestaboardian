export interface HistoryRow {
  liveAt: string;
  exitedAt: string;
  transport: string;
  message: string;
}

export const HISTORY_HEADING = "## Vestaboard History";
const HEADER = "| Live (sent) | Exited | Transport | Message |";
const DIVIDER = "| --- | --- | --- | --- |";
const LIVE_MARK = "— (live)";

export function truncateMessage(message: string, max = 18): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max) + "…";
}

function formatRow(row: HistoryRow): string {
  return `| ${row.liveAt} | ${row.exitedAt} | ${row.transport} | ${truncateMessage(row.message)} |`;
}

export function appendHistory(noteText: string, row: HistoryRow): string {
  const newRow = formatRow(row);
  const lines = noteText.split("\n");

  const headingIdx = lines.findIndex((l) => l.trim() === HISTORY_HEADING);

  if (headingIdx === -1) {
    const suffix = noteText.endsWith("\n") || noteText === "" ? "" : "\n";
    const block = [HISTORY_HEADING, HEADER, DIVIDER, newRow, ""].join("\n");
    return noteText + suffix + "\n" + block + "\n";
  }

  // Find the divider line after the heading; data rows follow it.
  let dividerIdx = -1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("| ---")) {
      dividerIdx = i;
      break;
    }
    if (lines[i].startsWith("#") && i !== headingIdx) break;
  }

  if (dividerIdx === -1) {
    // Heading exists but table is malformed/missing; rebuild table under heading.
    lines.splice(headingIdx + 1, 0, HEADER, DIVIDER, newRow);
    return lines.join("\n");
  }

  // Stamp the existing newest data row if it is still live.
  const firstDataIdx = dividerIdx + 1;
  if (firstDataIdx < lines.length && lines[firstDataIdx].includes(LIVE_MARK)) {
    lines[firstDataIdx] = lines[firstDataIdx].replace(LIVE_MARK, row.liveAt);
  }

  // Insert the new row as the newest (immediately after the divider).
  lines.splice(firstDataIdx, 0, newRow);
  return lines.join("\n");
}
