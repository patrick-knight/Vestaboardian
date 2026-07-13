import { describe, it, expect } from "vitest";
import { formatDate } from "../../src/obsidian/formatDate";

describe("formatDate", () => {
  it("formats with YYYY-MM-DD HH:mm", () => {
    const d = new Date(2026, 5, 30, 14, 3); // local time, June 30 2026 14:03
    expect(formatDate(d, "YYYY-MM-DD HH:mm")).toBe("2026-06-30 14:03");
  });
  it("zero-pads single digits", () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(formatDate(d, "YYYY-MM-DD HH:mm")).toBe("2026-01-05 09:07");
  });
  it("replaces repeated tokens everywhere, not just the first occurrence", () => {
    const d = new Date(2026, 6, 11, 8, 5);
    expect(formatDate(d, "MM/DD (MM-DD)")).toBe("07/11 (07-11)");
  });
  it("leaves unknown text untouched and never re-matches replaced output", () => {
    const d = new Date(2026, 6, 11, 8, 5);
    expect(formatDate(d, "at HH:mm o'clock")).toBe("at 08:05 o'clock");
  });
});
