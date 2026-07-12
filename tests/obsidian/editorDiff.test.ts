import { describe, it, expect } from "vitest";
import { computeMinimalEdit, type MinimalEdit } from "../../src/obsidian/editorDiff";

// Reference implementation of Editor.replaceRange semantics so every case
// verifies round-trip correctness: applying the edit to oldText MUST yield
// newText exactly.
function apply(text: string, edit: MinimalEdit | null): string {
  if (!edit) return text;
  const lines = text.split("\n");
  const before =
    lines.slice(0, edit.from.line).join("\n") +
    (edit.from.line > 0 ? "\n" : "") +
    lines[edit.from.line].slice(0, edit.from.ch);
  const after =
    lines[edit.to.line].slice(edit.to.ch) +
    (edit.to.line < lines.length - 1 ? "\n" : "") +
    lines.slice(edit.to.line + 1).join("\n");
  return before + edit.text + after;
}

function roundTrip(oldText: string, newText: string): void {
  expect(apply(oldText, computeMinimalEdit(oldText, newText))).toBe(newText);
}

describe("computeMinimalEdit", () => {
  it("returns null for identical texts", () => {
    expect(computeMinimalEdit("a\nb", "a\nb")).toBeNull();
  });

  it("round-trips appending a history block to a note", () => {
    const oldText = "# Note\n\n## Vestaboard\nHELLO\n";
    const newText =
      "# Note\n\n## Vestaboard\nHELLO\n\n## Vestaboard History\n| h |\n| --- |\n| row |\n";
    roundTrip(oldText, newText);
  });

  it("round-trips inserting a row into an existing history table", () => {
    const oldText = "## Vestaboard History\n| h |\n| --- |\n| old |\n";
    const newText = "## Vestaboard History\n| h |\n| --- |\n| new |\n| old-stamped |\n";
    roundTrip(oldText, newText);
  });

  it("does not touch lines outside the changed span", () => {
    const oldText = "keep1\nCHANGE\nkeep2";
    const edit = computeMinimalEdit(oldText, "keep1\nCHANGED\nkeep2");
    expect(edit).not.toBeNull();
    expect(edit!.from.line).toBe(1);
    expect(edit!.to.line).toBe(1);
    roundTrip(oldText, "keep1\nCHANGED\nkeep2");
  });

  it("round-trips pure append at end of file without trailing newline", () => {
    roundTrip("line1\nline2", "line1\nline2\nline3");
  });

  it("round-trips edits on an empty note", () => {
    roundTrip("", "## Vestaboard History\n| h |\n");
  });

  it("round-trips a mid-file replacement that changes line count", () => {
    roundTrip("a\nb\nc\nd", "a\nX\nY\nZ\nW\nd");
  });
});
