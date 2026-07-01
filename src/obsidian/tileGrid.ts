import type { Device } from "../core/device";
import type { RenderModel } from "../core/render";

export function renderTileGrid(
  parent: HTMLElement,
  model: RenderModel,
  device: Device,
): HTMLElement {
  const grid = parent.ownerDocument.createElement("div");
  grid.className = "vb-grid";
  grid.style.setProperty("--vb-cols", String(device.cols));

  for (const row of model) {
    for (const t of row) {
      const tile = parent.ownerDocument.createElement("div");
      tile.className = "vb-tile";
      if (t.colorName) tile.setAttribute("data-color", t.colorName);
      tile.textContent = t.glyph;
      grid.appendChild(tile);
    }
  }
  parent.appendChild(grid);
  return grid;
}
