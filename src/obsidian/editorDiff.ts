export interface EditorPos {
  line: number;
  ch: number;
}

export interface MinimalEdit {
  from: EditorPos;
  to: EditorPos;
  text: string;
}

// Compute the smallest line-span replacement that turns oldText into newText,
// for applying a history append through editor.replaceRange instead of
// setValue. A whole-buffer setValue resets the cursor/scroll and, applied to a
// stale snapshot, erases anything typed while the confirm modal or network
// round-trip was pending.
export function computeMinimalEdit(oldText: string, newText: string): MinimalEdit | null {
  if (oldText === newText) return null;
  const oldL = oldText.split("\n");
  const newL = newText.split("\n");

  let start = 0;
  while (start < oldL.length && start < newL.length && oldL[start] === newL[start]) {
    start++;
  }
  let endOld = oldL.length - 1;
  let endNew = newL.length - 1;
  while (endOld >= start && endNew >= start && oldL[endOld] === newL[endNew]) {
    endOld--;
    endNew--;
  }

  if (endOld < start) {
    // Pure insertion before line `start`: anchor at the start of that line (or
    // at the end of the last line when appending past the old text).
    const text = newL.slice(start, endNew + 1).join("\n");
    if (start >= oldL.length) {
      const lastLine = oldL.length - 1;
      const pos = { line: lastLine, ch: oldL[lastLine].length };
      return { from: pos, to: pos, text: "\n" + text };
    }
    const pos = { line: start, ch: 0 };
    return { from: pos, to: pos, text: text + "\n" };
  }

  return {
    from: { line: start, ch: 0 },
    to: { line: endOld, ch: oldL[endOld].length },
    text: newL.slice(start, endNew + 1).join("\n"),
  };
}
