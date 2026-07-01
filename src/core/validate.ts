import type { Device } from "./device";
import type { CompileResult } from "./compile";

export type ValidationError =
  | { kind: "RowTooWide"; row: number; length: number; max: number }
  | { kind: "TooManyRows"; got: number; max: number }
  | { kind: "UnsupportedChar"; char: string; row: number; col: number };

export function validate(result: CompileResult, device: Device): ValidationError[] {
  const errors: ValidationError[] = [];

  if (result.grid.length > device.rows) {
    errors.push({ kind: "TooManyRows", got: result.grid.length, max: device.rows });
  }

  for (const ow of result.overWidth) {
    errors.push({ kind: "RowTooWide", row: ow.row, length: ow.length, max: device.cols });
  }

  for (const issue of result.issues) {
    errors.push({
      kind: "UnsupportedChar",
      char: issue.char,
      row: issue.row,
      col: issue.col,
    });
  }

  return errors;
}

export function describeError(e: ValidationError): string {
  switch (e.kind) {
    case "RowTooWide":
      return `row ${e.row + 1} is ${e.length}/${e.max} wide`;
    case "TooManyRows":
      return `${e.got} rows exceeds the ${e.max}-row board`;
    case "UnsupportedChar":
      return `character '${e.char}' at row ${e.row + 1} col ${e.col + 1} is not supported`;
  }
}
