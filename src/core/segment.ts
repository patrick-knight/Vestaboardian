// Segment a line into user-perceived characters (grapheme clusters) so
// multi-codepoint emoji (e.g. "❤️") are not split. Falls back to code-point
// spread when Intl.Segmenter is unavailable. Shared by compile and autofix.
//
// The Segmenter is a module-level singleton: constructing one resolves locale
// data and is the expensive part, and the live-preview path calls graphemes()
// once per line on every keystroke.
const SEGMENTER =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export function graphemes(line: string): string[] {
  if (SEGMENTER) {
    return Array.from(SEGMENTER.segment(line), (s) => s.segment);
  }
  return Array.from(line);
}
