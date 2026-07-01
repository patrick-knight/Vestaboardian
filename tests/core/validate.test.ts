import { describe, it, expect } from "vitest";
import { validate, describeError } from "../../src/core/validate";
import { compile } from "../../src/core/compile";
import { FLAGSHIP } from "../../src/core/device";

describe("validate", () => {
  it("clean message yields no errors", () => {
    expect(validate(compile("HELLO", FLAGSHIP), FLAGSHIP)).toEqual([]);
  });

  it("flags a row that is too wide", () => {
    const errs = validate(compile("A".repeat(25), FLAGSHIP), FLAGSHIP);
    expect(errs).toContainEqual({ kind: "RowTooWide", row: 0, length: 25, max: 22 });
  });

  it("flags too many rows", () => {
    const errs = validate(compile("A\nB\nC\nD\nE\nF\nG", FLAGSHIP), FLAGSHIP);
    expect(errs).toContainEqual({ kind: "TooManyRows", got: 7, max: 6 });
  });

  it("flags unsupported characters from compile issues", () => {
    const errs = validate(compile("Añ", FLAGSHIP), FLAGSHIP);
    expect(errs).toContainEqual({ kind: "UnsupportedChar", char: "ñ", row: 0, col: 1 });
  });

  it("describeError is readable", () => {
    expect(describeError({ kind: "RowTooWide", row: 0, length: 25, max: 22 }))
      .toBe("row 1 is 25/22 wide");
  });
});
