import { describe, it, expect } from "vitest";
import { appendHistory, truncateMessage } from "../../src/obsidian/historyWriter";

describe("historyWriter", () => {
  it("creates the section and table when absent", () => {
    const out = appendHistory("# My note\n\nprose\n", {
      liveAt: "2026-06-30 14:03",
      exitedAt: "— (live)",
      transport: "cloud",
      message: "HELLO",
    });
    expect(out).toContain("## Vestaboard History");
    expect(out).toContain("| Live (sent) | Exited | Transport | Message |");
    expect(out).toContain("| 2026-06-30 14:03 | — (live) | cloud | HELLO |");
    expect(out.startsWith("# My note\n\nprose\n")).toBe(true);
  });

  it("does not add a leading blank line for empty notes", () => {
    const out = appendHistory("", {
      liveAt: "2026-06-30 14:03",
      exitedAt: "— (live)",
      transport: "cloud",
      message: "HELLO",
    });
    expect(out.startsWith("\n")).toBe(false);
    expect(out.startsWith("## Vestaboard History")).toBe(true);
  });

  it("inserts newest row first and stamps the previous live row's exit", () => {
    const first = appendHistory("# n\n", {
      liveAt: "2026-06-30 14:03", exitedAt: "— (live)", transport: "local", message: "ONE",
    });
    const second = appendHistory(first, {
      liveAt: "2026-06-30 15:10", exitedAt: "— (live)", transport: "cloud", message: "TWO",
    });
    const rows = second.split("\n").filter((l) => l.startsWith("| 2026"));
    // newest first
    expect(rows[0]).toContain("TWO");
    expect(rows[1]).toContain("ONE");
    // previous live row got its exit stamped to the new row's liveAt
    expect(rows[1]).toContain("2026-06-30 15:10");
    expect(rows[1]).not.toContain("— (live)");
  });

  it("does not disturb prose around the section", () => {
    const note = "# Title\n\nintro paragraph\n\n## Vestaboard\nHI\n";
    const out = appendHistory(note, {
      liveAt: "t", exitedAt: "— (live)", transport: "cloud", message: "HI",
    });
    expect(out).toContain("intro paragraph");
    expect(out).toContain("## Vestaboard\nHI");
  });

  it("truncateMessage collapses newlines and ellipsizes", () => {
    expect(truncateMessage("STANDUP IN\n10 MINUTES", 12)).toBe("STANDUP IN 1…");
  });
});
