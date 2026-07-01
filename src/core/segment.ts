// Segment a line into user-perceived characters (grapheme clusters) so
// multi-codepoint emoji (e.g. "❤️") are not split. Falls back to code-point
// spread when Intl.Segmenter is unavailable. Shared by compile and autofix.
export function graphemes(line: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(line), (s) => s.segment);
  }
  return Array.from(line);
}
