import { describe, it, expect } from "vitest";
import {
  charToCode,
  codeToGlyph,
  EMOJI_TO_CODE,
  isColorCode,
  BLANK,
} from "../../src/core/glyphMap";

describe("glyphMap forward", () => {
  it("space is blank 0", () => expect(charToCode(" ")).toBe(BLANK));
  it("A is 1, Z is 26, case-insensitive", () => {
    expect(charToCode("A")).toBe(1);
    expect(charToCode("z")).toBe(26);
  });
  it("digits: 1 is 27, 9 is 35, 0 is 36", () => {
    expect(charToCode("1")).toBe(27);
    expect(charToCode("9")).toBe(35);
    expect(charToCode("0")).toBe(36);
  });
  it("punctuation samples", () => {
    expect(charToCode("!")).toBe(37);
    expect(charToCode("?")).toBe(60);
    expect(charToCode("/")).toBe(59);
    expect(charToCode(".")).toBe(56);
  });
  it("unsupported char returns undefined", () => {
    expect(charToCode("ñ")).toBeUndefined();
    expect(charToCode("*")).toBeUndefined();
  });
});

describe("glyphMap emoji", () => {
  it("maps each color emoji to its code", () => {
    expect(EMOJI_TO_CODE.get("🟥")).toBe(63);
    expect(EMOJI_TO_CODE.get("🟦")).toBe(67);
    expect(EMOJI_TO_CODE.get("⬛")).toBe(70);
    expect(EMOJI_TO_CODE.get("⬜")).toBe(69);
  });
  it("heart (multi-codepoint) maps to 62", () => {
    expect(EMOJI_TO_CODE.get("❤️")).toBe(62);
  });
});

describe("glyphMap reverse", () => {
  it("letters and digits round-trip", () => {
    expect(codeToGlyph(1, "flagship")).toBe("A");
    expect(codeToGlyph(36, "flagship")).toBe("0");
  });
  it("62 is degree on flagship, heart on note", () => {
    expect(codeToGlyph(62, "flagship")).toBe("°");
    expect(codeToGlyph(62, "note")).toBe("♥");
  });
  it("color codes render no glyph", () => {
    expect(codeToGlyph(67, "flagship")).toBe("");
    expect(isColorCode(67)).toBe(true);
    expect(isColorCode(26)).toBe(false);
  });
});
