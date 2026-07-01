import { describe, it, expect } from "vitest";
import { render } from "../../src/core/render";
import { FLAGSHIP, NOTE } from "../../src/core/device";

describe("render", () => {
  it("produces exactly rows x cols tiles", () => {
    const model = render([[1, 2]], FLAGSHIP);
    expect(model.length).toBe(6);
    expect(model[0].length).toBe(22);
  });

  it("maps letter codes to glyphs", () => {
    const model = render([[1]], FLAGSHIP);
    expect(model[0][0]).toEqual({ code: 1, glyph: "A", colorName: null });
  });

  it("maps color codes to a colorName and empty glyph", () => {
    const model = render([[67]], FLAGSHIP);
    expect(model[0][0]).toEqual({ code: 67, glyph: "", colorName: "blue" });
  });

  it("renders 62 as degree on flagship and heart on note", () => {
    expect(render([[62]], FLAGSHIP)[0][0].glyph).toBe("°");
    expect(render([[62]], NOTE)[0][0].glyph).toBe("♥");
  });

  it("fills missing cells with blank tiles", () => {
    const model = render([], FLAGSHIP);
    expect(model[0][0]).toEqual({ code: 0, glyph: " ", colorName: null });
  });
});
