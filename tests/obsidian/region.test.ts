import { describe, it, expect } from "vitest";
import { readMessageRegion } from "../../src/obsidian/region";

const NOTE = [
  "# Title",
  "",
  "## Vestaboard",
  "🟦 STANDUP 🟦",
  "10 MINUTES",
  "",
  "## Vestaboard History",
  "| ... |",
].join("\n");

describe("readMessageRegion", () => {
  it("reads the block after the marker until the blank line", () => {
    const r = readMessageRegion(NOTE, "## Vestaboard", 6);
    expect(r.found).toBe(true);
    expect(r.message).toBe("🟦 STANDUP 🟦\n10 MINUTES");
  });

  it("returns found=false when marker absent", () => {
    expect(readMessageRegion("# Title\n\ntext", "## Vestaboard", 6).found).toBe(false);
  });

  it("stops at the next heading even without a blank line", () => {
    const text = "## Vestaboard\nHELLO\n## Next";
    expect(readMessageRegion(text, "## Vestaboard", 6).message).toBe("HELLO");
  });

  it("caps the message at maxRows lines", () => {
    const text = "## Vestaboard\nA\nB\nC\nD";
    expect(readMessageRegion(text, "## Vestaboard", 3).message).toBe("A\nB\nC");
  });

  it("skips leading blank lines after the marker", () => {
    const text = "## Vestaboard\n\n\nHELLO\n";
    expect(readMessageRegion(text, "## Vestaboard", 6).message).toBe("HELLO");
  });

  it("keeps a #-leading tile row that is not an ATX heading", () => {
    const text = "## Vestaboard\n#SALE\nTODAY";
    expect(readMessageRegion(text, "## Vestaboard", 6).message).toBe("#SALE\nTODAY");
  });

  it("still stops at a real ATX heading (# then space)", () => {
    const text = "## Vestaboard\nHELLO\n# Notes";
    expect(readMessageRegion(text, "## Vestaboard", 6).message).toBe("HELLO");
  });
});
