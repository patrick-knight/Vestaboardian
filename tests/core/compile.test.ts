import { describe, it, expect } from "vitest";
import { compile } from "../../src/core/compile";
import { FLAGSHIP, NOTE } from "../../src/core/device";

describe("compile", () => {
  it("compiles literal text padded to full device dimensions", () => {
    const r = compile("HI", FLAGSHIP);
    // Full-height grid: the transports POST it verbatim and the poller
    // compares it against the board's full readState.
    expect(r.grid.length).toBe(6);
    expect(r.grid[0].length).toBe(22);
    expect(r.grid[0].slice(0, 2)).toEqual([8, 9]); // H=8, I=9
    expect(r.grid[0].slice(2).every((c) => c === 0)).toBe(true);
    expect(r.grid.slice(1).every((row) => row.length === 22 && row.every((c) => c === 0))).toBe(
      true,
    );
    expect(r.issues).toEqual([]);
  });

  it("lowercases to uppercase codes", () => {
    const r = compile("hi", FLAGSHIP);
    expect(r.grid[0].slice(0, 2)).toEqual([8, 9]);
  });

  it("maps a color emoji to a single tile", () => {
    const r = compile("🟦X", FLAGSHIP);
    expect(r.grid[0].slice(0, 2)).toEqual([67, 24]); // blue, X=24
  });

  it("keeps the multi-codepoint heart as one tile (code 62)", () => {
    const r = compile("❤️", FLAGSHIP);
    expect(r.grid[0][0]).toBe(62);
    expect(r.grid[0].length).toBe(22);
  });

  it("records unsupported characters with location and emits no tile for them", () => {
    const r = compile("Añ", FLAGSHIP);
    expect(r.grid[0][0]).toBe(1); // A
    expect(r.issues).toEqual([{ kind: "unsupported", char: "ñ", row: 0, col: 1 }]);
  });

  it("handles multiple lines as rows and pads to device height", () => {
    const r = compile("AB\nCD", NOTE);
    expect(r.grid.length).toBe(3);
    expect(r.grid[0].slice(0, 2)).toEqual([1, 2]);
    expect(r.grid[1].slice(0, 2)).toEqual([3, 4]);
    expect(r.grid[2].every((c) => c === 0)).toBe(true);
  });

  it("records over-width rows without truncating", () => {
    const line = "A".repeat(25);
    const r = compile(line, FLAGSHIP);
    expect(r.grid[0].length).toBe(25);
    expect(r.overWidth).toEqual([{ row: 0, length: 25 }]);
  });
});
