import type { Device } from "../core/device";
import { compile } from "../core/compile";
import { validate, type ValidationError } from "../core/validate";
import { autofix } from "../core/autofix";
import { readMessageRegion } from "./region";

export interface SendPrep {
  found: boolean;
  /**
   * The message text that was actually compiled to the sent grid — the
   * auto-fixed text when auto-fix was applied, otherwise the original. History
   * and liveState should record THIS, so the note reflects what the board got.
   */
  message: string;
  grid: number[][];
  /** Remaining validation errors; empty means the grid is sendable. */
  errors: ValidationError[];
}

// Pure decision for a send: locate the message region, compile it, and — if
// auto-fix is enabled and the message is invalid — normalize it and recompile.
// Extracted from the plugin so the region→compile→autofix→validate pipeline is
// unit-testable without Obsidian.
export function prepareSend(
  text: string,
  marker: string,
  device: Device,
  autofixEnabled: boolean,
): SendPrep {
  const region = readMessageRegion(text, marker, device.rows);
  if (!region.found) return { found: false, message: "", grid: [], errors: [] };

  let message = region.message;
  let result = compile(message, device);
  let errors = validate(result, device);

  if (errors.length > 0 && autofixEnabled) {
    message = autofix(region.message, device);
    result = compile(message, device);
    errors = validate(result, device);
  }

  return { found: true, message, grid: result.grid, errors };
}
