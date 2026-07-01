import type { DeviceName } from "./device";

export const BLANK = 0;

// Forward: character -> code. Letters are stored uppercase.
const CHAR_TO_CODE = new Map<string, number>();

// Space
CHAR_TO_CODE.set(" ", 0);
// Letters A-Z => 1-26
for (let i = 0; i < 26; i++) {
  CHAR_TO_CODE.set(String.fromCharCode(65 + i), 1 + i);
}
// Digits 1-9 => 27-35, 0 => 36
for (let d = 1; d <= 9; d++) {
  CHAR_TO_CODE.set(String(d), 26 + d);
}
CHAR_TO_CODE.set("0", 36);
// Punctuation
const PUNCT: Array<[string, number]> = [
  ["!", 37], ["@", 38], ["#", 39], ["$", 40], ["(", 41], [")", 42],
  ["-", 44], ["+", 46], ["&", 47], ["=", 48], [";", 49], [":", 50],
  ["'", 52], ['"', 53], ["%", 54], [",", 55], [".", 56], ["/", 59],
  ["?", 60],
];
for (const [ch, code] of PUNCT) CHAR_TO_CODE.set(ch, code);

export function charToCode(ch: string): number | undefined {
  if (ch.length === 0) return undefined;
  const upper = ch.toUpperCase();
  return CHAR_TO_CODE.get(upper);
}

export const EMOJI_TO_CODE = new Map<string, number>([
  ["🟥", 63],
  ["🟧", 64],
  ["🟨", 65],
  ["🟩", 66],
  ["🟦", 67],
  ["🟪", 68],
  ["⬜", 69],
  ["⬛", 70],
  ["❤️", 62],
]);

export function isColorCode(code: number): boolean {
  return code >= 63 && code <= 71;
}

// Reverse: code -> glyph. Color codes render as background only ("").
const CODE_TO_GLYPH = new Map<number, string>();
for (const [ch, code] of CHAR_TO_CODE) CODE_TO_GLYPH.set(code, ch);

export function codeToGlyph(code: number, device: DeviceName): string {
  if (code === 0) return " ";
  if (code === 62) return device === "note" ? "♥" : "°";
  if (isColorCode(code)) return "";
  const glyph = CODE_TO_GLYPH.get(code);
  return glyph ?? "?";
}
