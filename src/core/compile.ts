import type { Device } from "./device";
import { BLANK, EMOJI_TO_CODE, charToCode } from "./glyphMap";
import { graphemes } from "./segment";

export interface CompileIssue {
  kind: "unsupported";
  char: string;
  row: number;
  col: number;
}

export interface CompileResult {
  grid: number[][];
  issues: CompileIssue[];
  overWidth: Array<{ row: number; length: number }>;
}

export function compile(text: string, device: Device): CompileResult {
  const lines = text.split("\n");
  const grid: number[][] = [];
  const issues: CompileIssue[] = [];
  const overWidth: Array<{ row: number; length: number }> = [];

  lines.forEach((line, row) => {
    const codes: number[] = [];
    let col = 0;
    for (const seg of graphemes(line)) {
      const emoji = EMOJI_TO_CODE.get(seg);
      if (emoji !== undefined) {
        codes.push(emoji);
        col++;
        continue;
      }
      const code = charToCode(seg);
      if (code !== undefined) {
        codes.push(code);
        col++;
        continue;
      }
      issues.push({ kind: "unsupported", char: seg, row, col });
      // no tile emitted; col not advanced (the char does not occupy a tile)
    }
    if (codes.length > device.cols) {
      overWidth.push({ row, length: codes.length });
    }
    while (codes.length < device.cols) codes.push(BLANK);
    grid.push(codes);
  });

  // Pad to the full device height: the transports POST this grid verbatim and
  // the poller compares it against the board's full readState, so a short grid
  // would mis-shape the payload and instantly false-trigger the exit detector.
  while (grid.length < device.rows) {
    grid.push(new Array<number>(device.cols).fill(BLANK));
  }

  return { grid, issues, overWidth };
}
