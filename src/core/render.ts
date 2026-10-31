import type { Device } from "./device";
import { codeToGlyph, colorName as colorNameFor, isColorCode } from "./glyphMap";

export interface Tile {
  code: number;
  glyph: string;
  colorName: string | null;
}

export type RenderModel = Tile[][];

function tile(code: number, device: Device): Tile {
  return {
    code,
    glyph: codeToGlyph(code, device.name),
    colorName: isColorCode(code) ? colorNameFor(code) : null,
  };
}

export function render(grid: number[][], device: Device): RenderModel {
  const model: RenderModel = [];
  for (let r = 0; r < device.rows; r++) {
    const srcRow = grid[r] ?? [];
    const row: Tile[] = [];
    for (let c = 0; c < device.cols; c++) {
      row.push(tile(srcRow[c] ?? 0, device));
    }
    model.push(row);
  }
  return model;
}
