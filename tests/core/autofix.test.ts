import { describe, it, expect } from "vitest";
import { autofix } from "../../src/core/autofix";
import { compile } from "../../src/core/compile";
import { validate } from "../../src/core/validate";
import { FLAGSHIP } from "../../src/core/device";

function isClean(text: string): boolean {
  return validate(compile(text, FLAGSHIP), FLAGSHIP).length === 0;
}

describe("autofix", () => {
  it("drops unsupported characters", () => {
    const fixed = autofix("AñB", FLAGSHIP);
    expect(fixed).toBe("AB");
    expect(isClean(fixed)).toBe(true);
  });

  it("truncates over-wide rows to device width", () => {
    const fixed = autofix("A".repeat(30), FLAGSHIP);
    expect(fixed).toBe("A".repeat(22));
    expect(isClean(fixed)).toBe(true);
  });

  it("drops rows beyond device height", () => {
    const fixed = autofix("A\nB\nC\nD\nE\nF\nG\nH", FLAGSHIP);
    expect(fixed.split("\n").length).toBe(6);
    expect(isClean(fixed)).toBe(true);
  });

  it("output always re-validates clean (combined)", () => {
    const fixed = autofix("Añ".repeat(20) + "\n".repeat(10), FLAGSHIP);
    expect(isClean(fixed)).toBe(true);
  });

  it("leaves an already-valid message unchanged", () => {
    expect(autofix("HELLO 🟦", FLAGSHIP)).toBe("HELLO 🟦");
  });
});
