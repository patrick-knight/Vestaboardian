import type { Device } from "./device";
import { EMOJI_TO_CODE, charToCode } from "./glyphMap";
import { graphemes } from "./segment";

function isSupported(seg: string): boolean {
  return EMOJI_TO_CODE.has(seg) || charToCode(seg) !== undefined;
}

export function autofix(text: string, device: Device): string {
  const lines = text.split("\n");
  const fixedRows: string[] = [];

  for (const line of lines) {
    if (fixedRows.length >= device.rows) break;
    const kept: string[] = [];
    for (const seg of graphemes(line)) {
      if (!isSupported(seg)) continue;
      if (kept.length >= device.cols) break;
      kept.push(seg);
    }
    fixedRows.push(kept.join(""));
  }

  return fixedRows.join("\n");
}
