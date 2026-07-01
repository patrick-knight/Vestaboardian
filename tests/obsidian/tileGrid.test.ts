// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderTileGrid } from "../../src/obsidian/tileGrid";
import { render } from "../../src/core/render";
import { FLAGSHIP } from "../../src/core/device";

describe("renderTileGrid", () => {
  it("creates rows x cols tiles", () => {
    const model = render([[1, 2]], FLAGSHIP);
    const el = renderTileGrid(document.createElement("div"), model, FLAGSHIP);
    expect(el.querySelectorAll(".vb-tile").length).toBe(6 * 22);
  });

  it("sets glyph text and color data attribute", () => {
    const model = render([[1, 67]], FLAGSHIP); // A, blue
    const el = renderTileGrid(document.createElement("div"), model, FLAGSHIP);
    const tiles = el.querySelectorAll(".vb-tile");
    expect(tiles[0].textContent).toBe("A");
    expect(tiles[1].getAttribute("data-color")).toBe("blue");
  });
});
