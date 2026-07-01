import { describe, it, expect } from "vitest";
import { FLAGSHIP, NOTE, deviceFor } from "../../src/core/device";

describe("device", () => {
  it("flagship is 6x22", () => {
    expect(FLAGSHIP).toEqual({ name: "flagship", rows: 6, cols: 22 });
  });
  it("note is 3x15", () => {
    expect(NOTE).toEqual({ name: "note", rows: 3, cols: 15 });
  });
  it("deviceFor resolves by name", () => {
    expect(deviceFor("flagship")).toBe(FLAGSHIP);
    expect(deviceFor("note")).toBe(NOTE);
  });
});
