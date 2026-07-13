import { describe, it, expect } from "vitest";
import { prepareSend } from "../../src/obsidian/sendPrep";
import { FLAGSHIP } from "../../src/core/device";

const M = "## Vestaboard";

describe("prepareSend", () => {
  it("found=false when the marker is absent", () => {
    const p = prepareSend("# note\n\ntext", M, FLAGSHIP, true);
    expect(p.found).toBe(false);
    expect(p.grid).toEqual([]);
    expect(p.errors).toEqual([]);
  });

  it("compiles a clean message with no errors", () => {
    const p = prepareSend(`${M}\nHELLO`, M, FLAGSHIP, false);
    expect(p.found).toBe(true);
    expect(p.errors).toEqual([]);
    expect(p.message).toBe("HELLO");
    expect(p.grid[0].slice(0, 5)).toEqual([8, 5, 12, 12, 15]); // H E L L O
  });

  it("returns errors (no autofix) for an invalid message", () => {
    const p = prepareSend(`${M}\n${"A".repeat(25)}`, M, FLAGSHIP, false);
    expect(p.found).toBe(true);
    expect(p.errors.length).toBeGreaterThan(0);
  });

  it("pads the grid to full device dimensions", () => {
    const p = prepareSend(`${M}\nHELLO`, M, FLAGSHIP, false);
    expect(p.grid.length).toBe(FLAGSHIP.rows);
    expect(p.grid.every((row) => row.length === FLAGSHIP.cols)).toBe(true);
  });

  it("reports TooManyRows for an over-tall message when autofix is off", () => {
    const lines = ["A", "B", "C", "D", "E", "F", "G"]; // 7 rows on a 6-row device
    const p = prepareSend(`${M}\n${lines.join("\n")}`, M, FLAGSHIP, false);
    expect(p.found).toBe(true);
    expect(p.errors.some((e) => e.kind === "TooManyRows")).toBe(true);
  });

  it("trims an over-tall message when autofix is on", () => {
    const lines = ["A", "B", "C", "D", "E", "F", "G"];
    const p = prepareSend(`${M}\n${lines.join("\n")}`, M, FLAGSHIP, true);
    expect(p.errors).toEqual([]);
    expect(p.grid.length).toBe(FLAGSHIP.rows);
    expect(p.message.split("\n")).toHaveLength(FLAGSHIP.rows);
  });

  it("auto-fixes when enabled and reports the FIXED message (item 4)", () => {
    // 'ñ' is unsupported; autofix drops it. The reported message must be the
    // fixed text the board actually received, not the original.
    const p = prepareSend(`${M}\nAñB`, M, FLAGSHIP, true);
    expect(p.found).toBe(true);
    expect(p.errors).toEqual([]);
    expect(p.message).toBe("AB");
    expect(p.grid[0].slice(0, 2)).toEqual([1, 2]); // A B, ñ gone
  });
});
