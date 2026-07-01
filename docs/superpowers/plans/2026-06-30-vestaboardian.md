# Vestaboardian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that compiles a message written in a note into a Vestaboard character-code grid, validates/auto-fixes/previews it, and posts it over the cloud Read/Write API or the LAN Local API, keeping a chronological history in the note.

**Architecture:** A pure, dependency-free `core/` (device specs → glyph map → compile → validate → autofix → render) with zero Obsidian or network imports, wrapped by thin `transport/` adapters (HTTP via Obsidian `requestUrl`) and `obsidian/` adapters (commands, settings, region reader, history writer, preview). The compiler output (`number[][]`) is the single source of truth shared by transports and preview.

**Tech Stack:** TypeScript, esbuild (bundle to `main.js`), vitest (unit tests), Obsidian plugin API. Node 26 / npm 11.

## Global Constraints

- **Language/build:** TypeScript compiled and bundled by esbuild to a single committed `main.js` (CommonJS, target `es2018`). `main.js` is **committed** (BRAT requires it); `node_modules` is git-ignored.
- **esbuild externals:** `obsidian`, `electron`, and the CodeMirror packages (`@codemirror/*`, `@lezer/*`) MUST be marked external — they are provided by the Obsidian runtime and must not be bundled.
- **Test runner:** vitest. Every "Run:" step that runs tests uses `npx vitest run <path>` (single run, non-watch).
- **Core purity:** files under `src/core/` MUST NOT import from `obsidian`, `node:*`, or any network API. They are pure functions over plain data and are unit-tested with no mocks.
- **All HTTP** goes through Obsidian's `requestUrl` (avoids Electron CORS for both LAN and cloud). Never use `fetch`/`axios`.
- **Character codes are authoritative (verified against docs.vestaboard.com):** `0`=blank; `1–26`=A–Z; `27–35`=1–9; `36`=0; `37`=! `38`=@ `39`=# `40`=$ `41`=( `42`=) `44`=- `46`=+ `47`=& `48`== `49`=; `50`=: `52`=' `53`=" `54`=% `55`=, `56`=. `59`=/ `60`=? `62`=°/♥ (device-dependent); colors `63`=red `64`=orange `65`=yellow `66`=green `67`=blue `68`=violet `69`=white `70`=black `71`=filled. **Unused/skipped codes:** `43, 45, 51, 57, 58, 61`. Lowercase letters uppercase automatically.
- **Emoji → code (each width 1):** 🟥→63, 🟧→64, 🟨→65, 🟩→66, 🟦→67, 🟪→68, ⬜→69, ⬛→70, ❤️→62.
- **Devices:** Flagship = 6 rows × 22 cols; Note = 3 rows × 15 cols.
- **Commit discipline:** TDD (red → green → commit). One logical change per commit, conventional-commit messages (`feat:`, `test:`, `chore:`).
- **Secrets:** API tokens live only in each vault's `.obsidian/plugins/vestaboardian/data.json`, never in this repo.

---

## File Structure

```
src/
  core/                 (pure, no obsidian/network imports)
    device.ts           Device type + FLAGSHIP/NOTE specs; deviceFor(name)
    glyphMap.ts         char→code, emoji→code (forward); code→glyph (reverse, device-aware)
    compile.ts          message text → CompileResult { grid, issues }
    validate.ts         CompileResult/grid → ValidationError[]
    autofix.ts          message text → fixed text that recompiles+revalidates clean
    render.ts           grid + device → RenderModel (per-tile glyph + color)
  transport/
    Transport.ts        interface Transport { send; readState }
    localTransport.ts   LocalTransport (Local API)
    cloudTransport.ts   CloudTransport (Read/Write API)
  obsidian/
    settings.ts         VestaboardianSettings type, DEFAULT_SETTINGS, SettingsTab
    region.ts           readMessageRegion(text, marker, maxRows)
    historyWriter.ts    upsert history table; stampExit logic
    PreviewView.ts      live right-sidebar ItemView
    ConfirmModal.ts     pre-send modal
    poller.ts           optional board-state polling
  main.ts               plugin entry: commands, ribbon, send flow, lifecycle
tests/                  vitest specs mirroring src/core, src/transport, src/obsidian
manifest.json
versions.json
package.json
tsconfig.json
esbuild.config.mjs
.gitignore
main.js                 (esbuild output, committed)
```

---

## Task 1: Repo scaffold and build/test toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`, `versions.json`, `.gitignore`, `src/main.ts`, `tests/smoke.test.ts`, `vitest.config.ts`, `tests/_stubs/obsidian.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run build` emits `main.js`; `npx vitest run` executes tests. A no-op `main.ts` exporting a default Plugin subclass. The vitest `obsidian` alias + stub so any `obsidian`-importing module (starting with `settings.ts` in Task 10) is unit-testable from the first core task onward.

This task is coarse boilerplate — no failing-test ceremony on config files. One smoke test proves the toolchain runs.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "vestaboardian",
  "version": "0.1.0",
  "description": "Send a Vestaboard message composed in an Obsidian note.",
  "main": "main.js",
  "type": "module",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc --noEmit && node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["obsidian", "vestaboard"],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^22.0.0",
    "builtin-modules": "^4.0.0",
    "esbuild": "^0.24.0",
    "obsidian": "^1.7.2",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2021", "DOM"],
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowJs": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create `esbuild.config.mjs`**

```js
import esbuild from "esbuild";
import builtins from "builtin-modules";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (production) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "id": "vestaboardian",
  "name": "Vestaboardian",
  "version": "0.1.0",
  "minAppVersion": "1.5.0",
  "description": "Compose a message in a note and send it to your Vestaboard display.",
  "author": "Patrick Knight",
  "authorUrl": "https://github.com/patrick-knight",
  "isDesktopOnly": true
}
```

`isDesktopOnly: true` because the Local API needs LAN HTTP from the device.

- [ ] **Step 5: Create `versions.json`**

```json
{
  "0.1.0": "1.5.0"
}
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
*.log
.DS_Store
data.json
```

(`main.js` is intentionally NOT ignored — BRAT installs it from the repo.)

- [ ] **Step 7: Create minimal `src/main.ts`**

```ts
import { Plugin } from "obsidian";

export default class VestaboardianPlugin extends Plugin {
  async onload(): Promise<void> {
    // Wired up in later tasks.
  }
}
```

- [ ] **Step 8: Create the vitest config and obsidian stub**

These are created here (not in a later task) because `settings.ts` (Task 10) is the first module that imports from `obsidian`, and without the alias vitest resolves the real `obsidian` package whose runtime exports are undefined — `class X extends PluginSettingTab` then throws `Class extends value undefined` at module load. Establishing the stub now makes every obsidian-importing task self-contained.

`tests/_stubs/obsidian.ts`:

```ts
// Minimal stubs so modules importing "obsidian" can be unit-tested.
export class Plugin {}
export class PluginSettingTab {
  constructor(_app: unknown, _plugin: unknown) {}
}
export class Setting {
  constructor(_el: unknown) {}
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addToggle() { return this; }
  addDropdown() { return this; }
  addButton() { return this; }
}
export class Modal {
  constructor(_app: unknown) {}
}
export class ItemView {
  constructor(_leaf: unknown) {}
}
export class Notice {
  constructor(_msg: string) {}
}
export type App = unknown;
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./tests/_stubs/obsidian.ts", import.meta.url)),
    },
  },
});
```

- [ ] **Step 9: Create `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 10: Install deps, build, and test**

Run: `npm install && npm run build && npx vitest run`
Expected: `npm install` succeeds; `main.js` is created at repo root; vitest reports `1 passed`.

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json esbuild.config.mjs manifest.json versions.json .gitignore src/main.ts tests/smoke.test.ts vitest.config.ts tests/_stubs/obsidian.ts main.js package-lock.json
git commit -m "chore: scaffold plugin build and test toolchain"
```

---

## Task 2: Core — device specs

**Files:**
- Create: `src/core/device.ts`
- Test: `tests/core/device.test.ts`

**Interfaces:**
- Produces:
  - `type DeviceName = "flagship" | "note"`
  - `interface Device { name: DeviceName; rows: number; cols: number }`
  - `const FLAGSHIP: Device` (6×22), `const NOTE: Device` (3×15)
  - `function deviceFor(name: DeviceName): Device`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/device.test.ts`
Expected: FAIL — cannot find module `../../src/core/device`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type DeviceName = "flagship" | "note";

export interface Device {
  name: DeviceName;
  rows: number;
  cols: number;
}

export const FLAGSHIP: Device = { name: "flagship", rows: 6, cols: 22 };
export const NOTE: Device = { name: "note", rows: 3, cols: 15 };

export function deviceFor(name: DeviceName): Device {
  return name === "note" ? NOTE : FLAGSHIP;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/device.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/device.ts tests/core/device.test.ts
git commit -m "feat: add device specs for flagship and note"
```

---

## Task 3: Core — glyph map (forward + reverse, device-aware)

**Files:**
- Create: `src/core/glyphMap.ts`
- Test: `tests/core/glyphMap.test.ts`

**Interfaces:**
- Consumes: `DeviceName` from `device.ts`.
- Produces:
  - `const BLANK = 0`
  - `function charToCode(ch: string): number | undefined` — single character (letter/digit/punct), case-insensitive for letters. Returns `undefined` if unsupported.
  - `const EMOJI_TO_CODE: Map<string, number>` — full-emoji-string (e.g. `"❤️"`) → code.
  - `function codeToGlyph(code: number, device: DeviceName): string` — reverse map for rendering; `62` → `"°"` on flagship, `"♥"` on note; colors → `""` (rendered as background, no glyph); unknown → `"?"`.
  - `function isColorCode(code: number): boolean` — true for 63–71.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/glyphMap.test.ts`
Expected: FAIL — cannot find module `glyphMap`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { DeviceName } from "./device";

export const BLANK = 0;

// Forward: character -> code. Letters are stored uppercase.
const CHAR_TO_CODE = new Map<string, number>();

// Space
CHAR_TO_CODE.set(" ", 0);
// Letters A-Z => 1-26
for (let i = 0; i < 26; i++) {
  CHAR_TO_CODE.set(String.fromCharCode(65 + i), 1 + i);
}
// Digits 1-9 => 27-35, 0 => 36
for (let d = 1; d <= 9; d++) {
  CHAR_TO_CODE.set(String(d), 26 + d);
}
CHAR_TO_CODE.set("0", 36);
// Punctuation
const PUNCT: Array<[string, number]> = [
  ["!", 37], ["@", 38], ["#", 39], ["$", 40], ["(", 41], [")", 42],
  ["-", 44], ["+", 46], ["&", 47], ["=", 48], [";", 49], [":", 50],
  ["'", 52], ['"', 53], ["%", 54], [",", 55], [".", 56], ["/", 59],
  ["?", 60],
];
for (const [ch, code] of PUNCT) CHAR_TO_CODE.set(ch, code);

export function charToCode(ch: string): number | undefined {
  if (ch.length === 0) return undefined;
  const upper = ch.toUpperCase();
  return CHAR_TO_CODE.get(upper);
}

export const EMOJI_TO_CODE = new Map<string, number>([
  ["🟥", 63],
  ["🟧", 64],
  ["🟨", 65],
  ["🟩", 66],
  ["🟦", 67],
  ["🟪", 68],
  ["⬜", 69],
  ["⬛", 70],
  ["❤️", 62],
]);

export function isColorCode(code: number): boolean {
  return code >= 63 && code <= 71;
}

// Reverse: code -> glyph. Color codes render as background only ("").
const CODE_TO_GLYPH = new Map<number, string>();
for (const [ch, code] of CHAR_TO_CODE) CODE_TO_GLYPH.set(code, ch);

export function codeToGlyph(code: number, device: DeviceName): string {
  if (code === 0) return " ";
  if (code === 62) return device === "note" ? "♥" : "°";
  if (isColorCode(code)) return "";
  const glyph = CODE_TO_GLYPH.get(code);
  return glyph ?? "?";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/glyphMap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/glyphMap.ts tests/core/glyphMap.test.ts
git commit -m "feat: add device-aware glyph map with emoji support"
```

---

## Task 4: Core — compiler (text → grid with grapheme-aware emoji)

**Files:**
- Create: `src/core/segment.ts`, `src/core/compile.ts`
- Test: `tests/core/compile.test.ts`

**Interfaces:**
- Consumes: `Device` from `device.ts`; `charToCode`, `EMOJI_TO_CODE`, `BLANK` from `glyphMap.ts`.
- Produces:
  - `function graphemes(line: string): string[]` (in `src/core/segment.ts`) — grapheme-cluster segmentation via `Intl.Segmenter`, falling back to code-point spread. Shared by `compile.ts` and `autofix.ts` (Task 6) so the segmentation logic exists in exactly one place.
  - `interface CompileIssue { kind: "unsupported"; char: string; row: number; col: number }`
  - `interface CompileResult { grid: number[][]; issues: CompileIssue[]; overWidth: Array<{ row: number; length: number }> }`
  - `function compile(text: string, device: Device): CompileResult`

**Behavior:** Split `text` into lines. For each line, segment into user-perceived characters (graphemes) so multi-codepoint emoji like `❤️` stay intact. Resolve each segment: first try `EMOJI_TO_CODE` (full segment), then `charToCode` (single char). Unsupported segments are recorded in `issues` (and contribute no tile). Each produced row is padded with `BLANK` to `device.cols`; rows longer than `device.cols` keep their full length here (compiler does not truncate) and are recorded in `overWidth`. Do not cap row count here.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { compile } from "../../src/core/compile";
import { FLAGSHIP, NOTE } from "../../src/core/device";

describe("compile", () => {
  it("compiles literal text padded to device width", () => {
    const r = compile("HI", FLAGSHIP);
    expect(r.grid.length).toBe(1);
    expect(r.grid[0].length).toBe(22);
    expect(r.grid[0].slice(0, 2)).toEqual([8, 9]); // H=8, I=9
    expect(r.grid[0].slice(2).every((c) => c === 0)).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("lowercases to uppercase codes", () => {
    const r = compile("hi", FLAGSHIP);
    expect(r.grid[0].slice(0, 2)).toEqual([8, 9]);
  });

  it("maps a color emoji to a single tile", () => {
    const r = compile("🟦X", FLAGSHIP);
    expect(r.grid[0].slice(0, 2)).toEqual([67, 24]); // blue, X=24
  });

  it("keeps the multi-codepoint heart as one tile (code 62)", () => {
    const r = compile("❤️", FLAGSHIP);
    expect(r.grid[0][0]).toBe(62);
    expect(r.grid[0].length).toBe(22);
  });

  it("records unsupported characters with location and emits no tile for them", () => {
    const r = compile("Añ", FLAGSHIP);
    expect(r.grid[0][0]).toBe(1); // A
    expect(r.issues).toEqual([{ kind: "unsupported", char: "ñ", row: 0, col: 1 }]);
  });

  it("handles multiple lines as rows", () => {
    const r = compile("AB\nCD", NOTE);
    expect(r.grid.length).toBe(2);
    expect(r.grid[0].slice(0, 2)).toEqual([1, 2]);
    expect(r.grid[1].slice(0, 2)).toEqual([3, 4]);
  });

  it("records over-width rows without truncating", () => {
    const line = "A".repeat(25);
    const r = compile(line, FLAGSHIP);
    expect(r.grid[0].length).toBe(25);
    expect(r.overWidth).toEqual([{ row: 0, length: 25 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/compile.test.ts`
Expected: FAIL — cannot find module `compile`.

- [ ] **Step 3: Write `src/core/segment.ts`**

```ts
// Segment a line into user-perceived characters (grapheme clusters) so
// multi-codepoint emoji (e.g. "❤️") are not split. Falls back to code-point
// spread when Intl.Segmenter is unavailable. Shared by compile and autofix.
export function graphemes(line: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter })
    .Segmenter;
  if (Seg) {
    const seg = new Seg(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(line), (s) => s.segment);
  }
  return Array.from(line);
}
```

- [ ] **Step 4: Write minimal implementation of `compile.ts`**

```ts
import type { Device } from "./device";
import { BLANK, EMOJI_TO_CODE, charToCode } from "./glyphMap";
import { graphemes } from "./segment";

export interface CompileIssue {
  kind: "unsupported";
  char: string;
  row: number;
  col: number;
}

export interface CompileResult {
  grid: number[][];
  issues: CompileIssue[];
  overWidth: Array<{ row: number; length: number }>;
}

export function compile(text: string, device: Device): CompileResult {
  const lines = text.split("\n");
  const grid: number[][] = [];
  const issues: CompileIssue[] = [];
  const overWidth: Array<{ row: number; length: number }> = [];

  lines.forEach((line, row) => {
    const codes: number[] = [];
    let col = 0;
    for (const seg of graphemes(line)) {
      const emoji = EMOJI_TO_CODE.get(seg);
      if (emoji !== undefined) {
        codes.push(emoji);
        col++;
        continue;
      }
      const code = charToCode(seg);
      if (code !== undefined) {
        codes.push(code);
        col++;
        continue;
      }
      issues.push({ kind: "unsupported", char: seg, row, col });
      // no tile emitted; col not advanced (the char does not occupy a tile)
    }
    if (codes.length > device.cols) {
      overWidth.push({ row, length: codes.length });
    }
    while (codes.length < device.cols) codes.push(BLANK);
    grid.push(codes);
  });

  return { grid, issues, overWidth };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/core/compile.test.ts`
Expected: PASS (7 tests). (`segment.ts` is exercised transitively here — the ❤️ test proves grapheme clustering — and again in Task 6's autofix tests.)

- [ ] **Step 6: Commit**

```bash
git add src/core/segment.ts src/core/compile.ts tests/core/compile.test.ts
git commit -m "feat: add grapheme segmentation and text-to-grid compiler"
```

---

## Task 5: Core — validation (device-aware typed errors)

**Files:**
- Create: `src/core/validate.ts`
- Test: `tests/core/validate.test.ts`

**Interfaces:**
- Consumes: `Device`; `CompileResult` from `compile.ts`.
- Produces:
  - `type ValidationError = | { kind: "RowTooWide"; row: number; length: number; max: number } | { kind: "TooManyRows"; got: number; max: number } | { kind: "UnsupportedChar"; char: string; row: number; col: number }`
  - `function validate(result: CompileResult, device: Device): ValidationError[]`
  - `function describeError(e: ValidationError): string` — human message, e.g. `"row 2 is 25/22 wide"`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { validate, describeError } from "../../src/core/validate";
import { compile } from "../../src/core/compile";
import { FLAGSHIP } from "../../src/core/device";

describe("validate", () => {
  it("clean message yields no errors", () => {
    expect(validate(compile("HELLO", FLAGSHIP), FLAGSHIP)).toEqual([]);
  });

  it("flags a row that is too wide", () => {
    const errs = validate(compile("A".repeat(25), FLAGSHIP), FLAGSHIP);
    expect(errs).toContainEqual({ kind: "RowTooWide", row: 0, length: 25, max: 22 });
  });

  it("flags too many rows", () => {
    const errs = validate(compile("A\nB\nC\nD\nE\nF\nG", FLAGSHIP), FLAGSHIP);
    expect(errs).toContainEqual({ kind: "TooManyRows", got: 7, max: 6 });
  });

  it("flags unsupported characters from compile issues", () => {
    const errs = validate(compile("Añ", FLAGSHIP), FLAGSHIP);
    expect(errs).toContainEqual({ kind: "UnsupportedChar", char: "ñ", row: 0, col: 1 });
  });

  it("describeError is readable", () => {
    expect(describeError({ kind: "RowTooWide", row: 0, length: 25, max: 22 }))
      .toBe("row 1 is 25/22 wide");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/validate.test.ts`
Expected: FAIL — cannot find module `validate`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/validate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/validate.ts tests/core/validate.test.ts
git commit -m "feat: add device-aware grid validation with typed errors"
```

---

## Task 6: Core — auto-fix

**Files:**
- Create: `src/core/autofix.ts`
- Test: `tests/core/autofix.test.ts`

**Interfaces:**
- Consumes: `Device`; `EMOJI_TO_CODE`, `charToCode` from `glyphMap.ts`; `graphemes` from `segment.ts`; (`compile`/`validate` used only in the test's `isClean` helper).
- Produces: `function autofix(text: string, device: Device): string` — returns a corrected message string whose `compile`→`validate` output is empty. Strategy: drop unsupported graphemes, truncate over-wide rows to `device.cols` graphemes, drop rows beyond `device.rows`. (Letter-casing is already handled by the compiler, so casing needs no change here.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { autofix } from "../../src/core/autofix";
import { compile } from "../../src/core/compile";
import { validate } from "../../src/core/validate";
import { FLAGSHIP } from "../../src/core/device";

function isClean(text: string): boolean {
  return validate(compile(text, FLAGSHIP), FLAGSHIP).length === 0;
}

describe("autofix", () => {
  it("drops unsupported characters", () => {
    const fixed = autofix("AñB", FLAGSHIP);
    expect(fixed).toBe("AB");
    expect(isClean(fixed)).toBe(true);
  });

  it("truncates over-wide rows to device width", () => {
    const fixed = autofix("A".repeat(30), FLAGSHIP);
    expect(fixed).toBe("A".repeat(22));
    expect(isClean(fixed)).toBe(true);
  });

  it("drops rows beyond device height", () => {
    const fixed = autofix("A\nB\nC\nD\nE\nF\nG\nH", FLAGSHIP);
    expect(fixed.split("\n").length).toBe(6);
    expect(isClean(fixed)).toBe(true);
  });

  it("output always re-validates clean (combined)", () => {
    const fixed = autofix("Añ".repeat(20) + "\n".repeat(10), FLAGSHIP);
    expect(isClean(fixed)).toBe(true);
  });

  it("leaves an already-valid message unchanged", () => {
    expect(autofix("HELLO 🟦", FLAGSHIP)).toBe("HELLO 🟦");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/autofix.test.ts`
Expected: FAIL — cannot find module `autofix`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Device } from "./device";
import { EMOJI_TO_CODE, charToCode } from "./glyphMap";
import { graphemes } from "./segment";

function isSupported(seg: string): boolean {
  return EMOJI_TO_CODE.has(seg) || charToCode(seg) !== undefined;
}

export function autofix(text: string, device: Device): string {
  const lines = text.split("\n");
  const fixedRows: string[] = [];

  for (const line of lines) {
    if (fixedRows.length >= device.rows) break;
    const kept: string[] = [];
    for (const seg of graphemes(line)) {
      if (!isSupported(seg)) continue;
      if (kept.length >= device.cols) break;
      kept.push(seg);
    }
    fixedRows.push(kept.join(""));
  }

  return fixedRows.join("\n");
}
```

Note: blank input lines stay as empty rows (still ≤ device width and within row cap), so they validate clean.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/autofix.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/autofix.ts tests/core/autofix.test.ts
git commit -m "feat: add auto-fix that normalizes a message to validate clean"
```

---

## Task 7: Core — render model

**Files:**
- Create: `src/core/render.ts`
- Test: `tests/core/render.test.ts`

**Interfaces:**
- Consumes: `Device`, `DeviceName`; `codeToGlyph`, `isColorCode` from `glyphMap.ts`.
- Produces:
  - `interface Tile { code: number; glyph: string; colorName: string | null }`
  - `type RenderModel = Tile[][]`
  - `function render(grid: number[][], device: Device): RenderModel` — pads/truncates each row to `device.cols` and the grid to `device.rows` (fills missing with blank tiles) so the preview is always exactly `rows × cols`. Each tile carries its glyph (device-aware) and a CSS color name for color codes (`null` otherwise).

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/render.test.ts`
Expected: FAIL — cannot find module `render`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Device } from "./device";
import { codeToGlyph, isColorCode } from "./glyphMap";

export interface Tile {
  code: number;
  glyph: string;
  colorName: string | null;
}

export type RenderModel = Tile[][];

const COLOR_NAME: Record<number, string> = {
  63: "red",
  64: "orange",
  65: "yellow",
  66: "green",
  67: "blue",
  68: "violet",
  69: "white",
  70: "black",
  71: "filled",
};

function tile(code: number, device: Device): Tile {
  return {
    code,
    glyph: codeToGlyph(code, device.name),
    colorName: isColorCode(code) ? COLOR_NAME[code] ?? null : null,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/render.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/render.ts tests/core/render.test.ts
git commit -m "feat: add render model mapping grid to preview tiles"
```

---

## Task 8: Transport interface + Local API transport

**Files:**
- Create: `src/transport/Transport.ts`, `src/transport/localTransport.ts`
- Test: `tests/transport/localTransport.test.ts`

**Interfaces:**
- Produces:
  - `interface Transport { send(grid: number[][]): Promise<void>; readState(): Promise<number[][]> }`
  - `type RequestFn = (opts: { url: string; method?: string; headers?: Record<string,string>; body?: string }) => Promise<{ status: number; json: unknown; text: string }>`
  - `class LocalTransport implements Transport` — constructed with `{ host: string; apiKey: string; request: RequestFn }`.
  - `static LocalTransport.enable(host: string, enablementToken: string, request: RequestFn): Promise<string>` — one-time enablement returning the persistent `apiKey`.

The injected `RequestFn` is Obsidian's `requestUrl` in production and a stub in tests (keeps core/transport testable without network).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { LocalTransport } from "../../src/transport/localTransport";

function grid(): number[][] {
  return [[1, 2, 3]];
}

describe("LocalTransport", () => {
  it("POSTs the grid with the local api key header", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: {}, text: "" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    await t.send(grid());
    expect(request).toHaveBeenCalledWith({
      url: "http://vestaboard.local:7000/local-api/message",
      method: "POST",
      headers: { "X-Vestaboard-Local-Api-Key": "KEY", "Content-Type": "application/json" },
      body: JSON.stringify(grid()),
    });
  });

  it("readState GETs and returns the raw 2D array the Local API sends", async () => {
    const board = [[1, 2]];
    // Verified against docs.vestaboard.com: the Local API GET returns the grid
    // directly as a 2D array (not wrapped in a `message` key).
    const request = vi.fn().mockResolvedValue({ status: 200, json: board, text: "" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    expect(await t.readState()).toEqual(board);
    expect(request).toHaveBeenCalledWith({
      url: "http://vestaboard.local:7000/local-api/message",
      method: "GET",
      headers: { "X-Vestaboard-Local-Api-Key": "KEY" },
    });
  });

  it("readState also tolerates a {message} wrapper if firmware returns one", async () => {
    const board = [[3, 4]];
    const request = vi.fn().mockResolvedValue({ status: 200, json: { message: board }, text: "" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    expect(await t.readState()).toEqual(board);
  });

  it("throws on non-2xx send", async () => {
    const request = vi.fn().mockResolvedValue({ status: 401, json: {}, text: "nope" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    await expect(t.send(grid())).rejects.toThrow(/401/);
  });

  it("enable() posts the enablement token and returns apiKey", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: { apiKey: "NEWKEY" }, text: "" });
    const key = await LocalTransport.enable("vestaboard.local", "ENABLE", request);
    expect(key).toBe("NEWKEY");
    expect(request).toHaveBeenCalledWith({
      url: "http://vestaboard.local:7000/local-api/enablement",
      method: "POST",
      headers: { "X-Vestaboard-Local-Api-Enablement-Token": "ENABLE" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transport/localTransport.test.ts`
Expected: FAIL — cannot find module `localTransport`.

- [ ] **Step 3: Write `Transport.ts`**

```ts
export interface Transport {
  send(grid: number[][]): Promise<void>;
  readState(): Promise<number[][]>;
}

export type RequestFn = (opts: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; json: unknown; text: string }>;
```

- [ ] **Step 4: Write `localTransport.ts`**

```ts
import type { Transport, RequestFn } from "./Transport";

interface LocalOpts {
  host: string;
  apiKey: string;
  request: RequestFn;
}

export class LocalTransport implements Transport {
  constructor(private opts: LocalOpts) {}

  private url(): string {
    return `http://${this.opts.host}:7000/local-api/message`;
  }

  async send(grid: number[][]): Promise<void> {
    const res = await this.opts.request({
      url: this.url(),
      method: "POST",
      headers: {
        "X-Vestaboard-Local-Api-Key": this.opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(grid),
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Local API send failed: ${res.status} ${res.text}`);
    }
  }

  async readState(): Promise<number[][]> {
    const res = await this.opts.request({
      url: this.url(),
      method: "GET",
      headers: { "X-Vestaboard-Local-Api-Key": this.opts.apiKey },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Local API read failed: ${res.status} ${res.text}`);
    }
    // The Local API returns the grid directly as a 2D array; tolerate a
    // {message: [...]} wrapper as well in case firmware versions differ.
    if (Array.isArray(res.json)) return res.json as number[][];
    const body = res.json as { message?: number[][] };
    return body.message ?? [];
  }

  static async enable(
    host: string,
    enablementToken: string,
    request: RequestFn,
  ): Promise<string> {
    const res = await request({
      url: `http://${host}:7000/local-api/enablement`,
      method: "POST",
      headers: { "X-Vestaboard-Local-Api-Enablement-Token": enablementToken },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Enablement failed: ${res.status} ${res.text}`);
    }
    return (res.json as { apiKey: string }).apiKey;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/transport/localTransport.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/transport/Transport.ts src/transport/localTransport.ts tests/transport/localTransport.test.ts
git commit -m "feat: add Transport interface and Local API transport"
```

---

## Task 9: Cloud Read/Write API transport

**Files:**
- Create: `src/transport/cloudTransport.ts`
- Test: `tests/transport/cloudTransport.test.ts`

**Interfaces:**
- Consumes: `Transport`, `RequestFn`.
- Produces: `class CloudTransport implements Transport` — constructed with `{ apiKey: string; request: RequestFn }`. Sends the character-code array to the Read/Write API; `readState()` reads current board. Uses base URL `https://rw.vestaboard.com/` with header `X-Vestaboard-Read-Write-Key`. The POST body is the grid JSON; the read response's `currentMessage.layout` is a JSON string of the grid (verified against docs.vestaboard.com).

> **Verify before trusting (constants, not logic):** Vestaboard's docs describe two distinct cloud products — the **Read/Write API** (`rw.vestaboard.com`, header `X-Vestaboard-Read-Write-Key`) that spec §9 names, and the **Subscription Cloud API** (`cloud.vestaboard.com`, header `X-Vestaboard-Token`). This plan targets the Read/Write API per the spec. The `currentMessage.layout`-as-JSON-string read shape is confirmed; the POST body (raw `[[...]]` array) is the documented form but is also accepted as `{characters: [[...]]}`. During execution, confirm the base URL, header, and accepted POST body against the developer's actual Read/Write key + board before relying on a physical send. The mocked tests below pin the shape this plan assumes; they do not prove it against the live API.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { CloudTransport } from "../../src/transport/cloudTransport";

describe("CloudTransport", () => {
  it("POSTs the grid with the read-write key header", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: {}, text: "" });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    await t.send([[1, 2]]);
    expect(request).toHaveBeenCalledWith({
      url: "https://rw.vestaboard.com/",
      method: "POST",
      headers: { "X-Vestaboard-Read-Write-Key": "RWKEY", "Content-Type": "application/json" },
      body: JSON.stringify([[1, 2]]),
    });
  });

  it("readState parses the layout JSON string", async () => {
    const board = [[1, 2]];
    const request = vi.fn().mockResolvedValue({
      status: 200,
      json: { currentMessage: { layout: JSON.stringify(board) } },
      text: "",
    });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    expect(await t.readState()).toEqual(board);
  });

  it("throws on non-2xx", async () => {
    const request = vi.fn().mockResolvedValue({ status: 403, json: {}, text: "denied" });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    await expect(t.send([[1]])).rejects.toThrow(/403/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transport/cloudTransport.test.ts`
Expected: FAIL — cannot find module `cloudTransport`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Transport, RequestFn } from "./Transport";

interface CloudOpts {
  apiKey: string;
  request: RequestFn;
}

const BASE = "https://rw.vestaboard.com/";

export class CloudTransport implements Transport {
  constructor(private opts: CloudOpts) {}

  async send(grid: number[][]): Promise<void> {
    const res = await this.opts.request({
      url: BASE,
      method: "POST",
      headers: {
        "X-Vestaboard-Read-Write-Key": this.opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(grid),
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Cloud API send failed: ${res.status} ${res.text}`);
    }
  }

  async readState(): Promise<number[][]> {
    const res = await this.opts.request({
      url: BASE,
      method: "GET",
      headers: { "X-Vestaboard-Read-Write-Key": this.opts.apiKey },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Cloud API read failed: ${res.status} ${res.text}`);
    }
    const body = res.json as { currentMessage?: { layout?: string } };
    const layout = body.currentMessage?.layout;
    return layout ? (JSON.parse(layout) as number[][]) : [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transport/cloudTransport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/transport/cloudTransport.ts tests/transport/cloudTransport.test.ts
git commit -m "feat: add cloud Read/Write API transport"
```

---

## Task 10: Settings model and tab

**Files:**
- Create: `src/obsidian/settings.ts`
- Test: `tests/obsidian/settings.test.ts`

**Interfaces:**
- Produces:
  - `interface VestaboardianSettings { device: DeviceName; defaultTransport: "local" | "cloud"; cloudKey: string; localHost: string; localKey: string; marker: string; autofixDefault: boolean; pollingEnabled: boolean; pollingIntervalSec: number; dateFormat: string; liveState: LiveState | null }`
  - `interface LiveState { grid: number[][]; transport: "local" | "cloud"; message: string; liveAt: string }`
  - `const DEFAULT_SETTINGS: VestaboardianSettings`
  - `const MIN_POLL_SEC = 15`
  - `class VestaboardianSettingTab extends PluginSettingTab` (constructed with the plugin; renders the controls). Not unit-tested (Obsidian UI); only the data model + `DEFAULT_SETTINGS` are tested.

This task is coarse: the SettingTab is straightforward Obsidian boilerplate. The test covers only defaults and the polling floor helper.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, MIN_POLL_SEC, floorPollInterval } from "../../src/obsidian/settings";

describe("settings", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_SETTINGS.device).toBe("flagship");
    expect(DEFAULT_SETTINGS.defaultTransport).toBe("cloud");
    expect(DEFAULT_SETTINGS.marker).toBe("## Vestaboard");
    expect(DEFAULT_SETTINGS.liveState).toBeNull();
  });

  it("floors the poll interval to the minimum", () => {
    expect(floorPollInterval(5)).toBe(MIN_POLL_SEC);
    expect(floorPollInterval(30)).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/settings.test.ts`
Expected: FAIL — cannot find module `settings`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import type { DeviceName } from "../core/device";

export interface LiveState {
  grid: number[][];
  transport: "local" | "cloud";
  message: string;
  liveAt: string;
}

export interface VestaboardianSettings {
  device: DeviceName;
  defaultTransport: "local" | "cloud";
  cloudKey: string;
  localHost: string;
  localKey: string;
  marker: string;
  autofixDefault: boolean;
  pollingEnabled: boolean;
  pollingIntervalSec: number;
  dateFormat: string;
  liveState: LiveState | null;
}

export const MIN_POLL_SEC = 15;

export const DEFAULT_SETTINGS: VestaboardianSettings = {
  device: "flagship",
  defaultTransport: "cloud",
  cloudKey: "",
  localHost: "vestaboard.local",
  localKey: "",
  marker: "## Vestaboard",
  autofixDefault: true,
  pollingEnabled: false,
  pollingIntervalSec: 30,
  dateFormat: "YYYY-MM-DD HH:mm",
  liveState: null,
};

export function floorPollInterval(sec: number): number {
  return Math.max(MIN_POLL_SEC, Math.floor(sec));
}

interface SettingsHost extends Plugin {
  settings: VestaboardianSettings;
  saveSettings(): Promise<void>;
}

export class VestaboardianSettingTab extends PluginSettingTab {
  constructor(app: App, private host: SettingsHost) {
    super(app, host);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.host.settings;

    new Setting(containerEl)
      .setName("Device")
      .addDropdown((d) =>
        d
          .addOption("flagship", "Flagship (6×22)")
          .addOption("note", "Note (3×15)")
          .setValue(s.device)
          .onChange(async (v) => {
            s.device = v as DeviceName;
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default transport")
      .addDropdown((d) =>
        d
          .addOption("cloud", "Cloud (Read/Write API)")
          .addOption("local", "Local (LAN API)")
          .setValue(s.defaultTransport)
          .onChange(async (v) => {
            s.defaultTransport = v as "local" | "cloud";
            await this.host.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Cloud Read/Write key")
      .addText((t) =>
        t.setValue(s.cloudKey).onChange(async (v) => {
          s.cloudKey = v.trim();
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl).setName("Local host").addText((t) =>
      t.setValue(s.localHost).onChange(async (v) => {
        s.localHost = v.trim();
        await this.host.saveSettings();
      }),
    );

    new Setting(containerEl).setName("Local API key").addText((t) =>
      t.setValue(s.localKey).onChange(async (v) => {
        s.localKey = v.trim();
        await this.host.saveSettings();
      }),
    );

    new Setting(containerEl)
      .setName("Message marker heading")
      .addText((t) =>
        t.setValue(s.marker).onChange(async (v) => {
          s.marker = v.trim() || "## Vestaboard";
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Auto-fix by default")
      .addToggle((t) =>
        t.setValue(s.autofixDefault).onChange(async (v) => {
          s.autofixDefault = v;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Poll the board for exit times")
      .addToggle((t) =>
        t.setValue(s.pollingEnabled).onChange(async (v) => {
          s.pollingEnabled = v;
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(`Poll interval (seconds, min ${MIN_POLL_SEC})`)
      .addText((t) =>
        t.setValue(String(s.pollingIntervalSec)).onChange(async (v) => {
          s.pollingIntervalSec = floorPollInterval(Number(v) || MIN_POLL_SEC);
          await this.host.saveSettings();
        }),
      );

    new Setting(containerEl).setName("History date format").addText((t) =>
      t.setValue(s.dateFormat).onChange(async (v) => {
        s.dateFormat = v;
        await this.host.saveSettings();
      }),
    );

    containerEl.createEl("p", {
      text: "API tokens are stored in plaintext in this vault's data.json.",
      cls: "setting-item-description",
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/settings.test.ts`
Expected: PASS (2 tests).

Note: the test imports only the pure exports, but vitest still parses the `obsidian` import in `settings.ts`. The `obsidian` alias + stub created in Task 1 (Step 8) resolves this — no extra setup needed here.

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/settings.ts tests/obsidian/settings.test.ts
git commit -m "feat: add settings model and settings tab"
```

---

## Task 11: Message region reader

**Files:**
- Create: `src/obsidian/region.ts`
- Test: `tests/obsidian/region.test.ts`

**Interfaces:**
- Produces:
  - `interface MessageRegion { found: boolean; message: string; startLine: number; endLine: number }`
  - `function readMessageRegion(text: string, marker: string, maxRows: number): MessageRegion`

**Behavior:** Find the first line equal to `marker` (trimmed). The message is the block from the first non-blank line after the marker up to (exclusive) the next blank line, the next heading (`#`-prefixed), or end of file — capped at `maxRows` lines. `startLine`/`endLine` are 0-based line indices of the message block (for the history writer to know where prose ends). `found=false` when the marker is absent.

(The vitest `obsidian` alias + stub already exist from Task 1, Step 8.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { readMessageRegion } from "../../src/obsidian/region";

const NOTE = [
  "# Title",
  "",
  "## Vestaboard",
  "🟦 STANDUP 🟦",
  "10 MINUTES",
  "",
  "## Vestaboard History",
  "| ... |",
].join("\n");

describe("readMessageRegion", () => {
  it("reads the block after the marker until the blank line", () => {
    const r = readMessageRegion(NOTE, "## Vestaboard", 6);
    expect(r.found).toBe(true);
    expect(r.message).toBe("🟦 STANDUP 🟦\n10 MINUTES");
  });

  it("returns found=false when marker absent", () => {
    expect(readMessageRegion("# Title\n\ntext", "## Vestaboard", 6).found).toBe(false);
  });

  it("stops at the next heading even without a blank line", () => {
    const text = "## Vestaboard\nHELLO\n## Next";
    expect(readMessageRegion(text, "## Vestaboard", 6).message).toBe("HELLO");
  });

  it("caps the message at maxRows lines", () => {
    const text = "## Vestaboard\nA\nB\nC\nD";
    expect(readMessageRegion(text, "## Vestaboard", 3).message).toBe("A\nB\nC");
  });

  it("skips leading blank lines after the marker", () => {
    const text = "## Vestaboard\n\n\nHELLO\n";
    expect(readMessageRegion(text, "## Vestaboard", 6).message).toBe("HELLO");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/region.test.ts`
Expected: FAIL — cannot find module `region`.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface MessageRegion {
  found: boolean;
  message: string;
  startLine: number;
  endLine: number;
}

const EMPTY: MessageRegion = { found: false, message: "", startLine: -1, endLine: -1 };

export function readMessageRegion(
  text: string,
  marker: string,
  maxRows: number,
): MessageRegion {
  const lines = text.split("\n");
  const markerTrim = marker.trim();

  let markerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === markerTrim) {
      markerIdx = i;
      break;
    }
  }
  if (markerIdx === -1) return EMPTY;

  // Skip blank lines after the marker.
  let start = markerIdx + 1;
  while (start < lines.length && lines[start].trim() === "") start++;
  if (start >= lines.length) return { ...EMPTY, found: true };

  const collected: string[] = [];
  let i = start;
  for (; i < lines.length && collected.length < maxRows; i++) {
    const line = lines[i];
    if (line.trim() === "") break;
    if (line.startsWith("#")) break;
    collected.push(line);
  }

  return {
    found: true,
    message: collected.join("\n"),
    startLine: start,
    endLine: start + collected.length - 1,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/region.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/region.ts tests/obsidian/region.test.ts
git commit -m "feat: add message region reader"
```

---

## Task 12: History writer (table upsert + infer-on-next-post)

**Files:**
- Create: `src/obsidian/historyWriter.ts`
- Test: `tests/obsidian/historyWriter.test.ts`

**Interfaces:**
- Produces:
  - `interface HistoryRow { liveAt: string; exitedAt: string; transport: string; message: string }`
  - `const HISTORY_HEADING = "## Vestaboard History"`
  - `function appendHistory(noteText: string, row: HistoryRow): string` — ensures the history section + table header exist (creating them at end of note if absent, never touching other prose), inserts `row` as the **newest-first** first data row, and stamps the **previous** newest row's `Exited` column to this row's `liveAt` if that previous row was `— (live)`.
  - `function truncateMessage(message: string, max?: number): string` — single-line, ellipsized preview for the table cell (default max 18).

**Behavior:** The function is pure string-in/string-out (no Obsidian I/O) so it is fully unit-testable; `main.ts` reads the file, calls this, and writes it back.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { appendHistory, truncateMessage } from "../../src/obsidian/historyWriter";

describe("historyWriter", () => {
  it("creates the section and table when absent", () => {
    const out = appendHistory("# My note\n\nprose\n", {
      liveAt: "2026-06-30 14:03",
      exitedAt: "— (live)",
      transport: "cloud",
      message: "HELLO",
    });
    expect(out).toContain("## Vestaboard History");
    expect(out).toContain("| Live (sent) | Exited | Transport | Message |");
    expect(out).toContain("| 2026-06-30 14:03 | — (live) | cloud | HELLO |");
    expect(out.startsWith("# My note\n\nprose\n")).toBe(true);
  });

  it("inserts newest row first and stamps the previous live row's exit", () => {
    const first = appendHistory("# n\n", {
      liveAt: "2026-06-30 14:03", exitedAt: "— (live)", transport: "local", message: "ONE",
    });
    const second = appendHistory(first, {
      liveAt: "2026-06-30 15:10", exitedAt: "— (live)", transport: "cloud", message: "TWO",
    });
    const rows = second.split("\n").filter((l) => l.startsWith("| 2026"));
    // newest first
    expect(rows[0]).toContain("TWO");
    expect(rows[1]).toContain("ONE");
    // previous live row got its exit stamped to the new row's liveAt
    expect(rows[1]).toContain("2026-06-30 15:10");
    expect(rows[1]).not.toContain("— (live)");
  });

  it("does not disturb prose around the section", () => {
    const note = "# Title\n\nintro paragraph\n\n## Vestaboard\nHI\n";
    const out = appendHistory(note, {
      liveAt: "t", exitedAt: "— (live)", transport: "cloud", message: "HI",
    });
    expect(out).toContain("intro paragraph");
    expect(out).toContain("## Vestaboard\nHI");
  });

  it("truncateMessage collapses newlines and ellipsizes", () => {
    expect(truncateMessage("STANDUP IN\n10 MINUTES", 12)).toBe("STANDUP IN 1…");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/historyWriter.test.ts`
Expected: FAIL — cannot find module `historyWriter`.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface HistoryRow {
  liveAt: string;
  exitedAt: string;
  transport: string;
  message: string;
}

export const HISTORY_HEADING = "## Vestaboard History";
const HEADER = "| Live (sent) | Exited | Transport | Message |";
const DIVIDER = "| --- | --- | --- | --- |";
const LIVE_MARK = "— (live)";

export function truncateMessage(message: string, max = 18): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max) + "…";
}

function formatRow(row: HistoryRow): string {
  return `| ${row.liveAt} | ${row.exitedAt} | ${row.transport} | ${truncateMessage(row.message)} |`;
}

export function appendHistory(noteText: string, row: HistoryRow): string {
  const newRow = formatRow(row);
  const lines = noteText.split("\n");

  const headingIdx = lines.findIndex((l) => l.trim() === HISTORY_HEADING);

  if (headingIdx === -1) {
    const suffix = noteText.endsWith("\n") || noteText === "" ? "" : "\n";
    const block = [HISTORY_HEADING, HEADER, DIVIDER, newRow, ""].join("\n");
    return noteText + suffix + "\n" + block + "\n";
  }

  // Find the divider line after the heading; data rows follow it.
  let dividerIdx = -1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("| ---")) {
      dividerIdx = i;
      break;
    }
    if (lines[i].startsWith("#") && i !== headingIdx) break;
  }

  if (dividerIdx === -1) {
    // Heading exists but table is malformed/missing; rebuild table under heading.
    lines.splice(headingIdx + 1, 0, HEADER, DIVIDER, newRow);
    return lines.join("\n");
  }

  // Stamp the existing newest data row if it is still live.
  const firstDataIdx = dividerIdx + 1;
  if (firstDataIdx < lines.length && lines[firstDataIdx].includes(LIVE_MARK)) {
    lines[firstDataIdx] = lines[firstDataIdx].replace(LIVE_MARK, row.liveAt);
  }

  // Insert the new row as the newest (immediately after the divider).
  lines.splice(firstDataIdx, 0, newRow);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/historyWriter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/historyWriter.ts tests/obsidian/historyWriter.test.ts
git commit -m "feat: add history table writer with infer-on-next-post exit stamping"
```

---

## Task 13: Plugin entry — commands and send flow

**Files:**
- Modify: `src/main.ts`
- Create: `src/obsidian/formatDate.ts`
- Test: `tests/obsidian/formatDate.test.ts`

**Interfaces:**
- Consumes: everything above — `deviceFor`, `compile`, `validate`/`describeError`, `autofix`, `render`, `LocalTransport`, `CloudTransport`, settings, `readMessageRegion`, `appendHistory`/`truncateMessage`, `ConfirmModal` (Task 14, wired here but Modal added next task — for this task, use a temporary direct-send path and a `// TODO confirm modal` is NOT allowed; instead order Task 14 before wiring the modal). **Order note:** implement Task 14 (ConfirmModal) before this task's modal wiring, OR wire send to go straight through and add the modal in Task 14. This plan wires the modal here and depends on Task 14 being completed first.
- Produces: registered commands:
  - `vestaboardian-send` — "Send message from this note" (default transport)
  - `vestaboardian-send-local` — "…via Local"
  - `vestaboardian-send-cloud` — "…via Cloud"
  - a ribbon icon invoking `vestaboardian-send`.
- The only independently unit-tested unit here is `formatDate` (pure). The wiring is verified manually in Obsidian (Task 17).

**Reordering:** Do Task 14 before Task 13's modal step. The plan lists Task 13 first for narrative flow, but the executor should build `ConfirmModal` (Task 14) before wiring it in.

- [ ] **Step 1: Write the failing test for `formatDate`**

```ts
import { describe, it, expect } from "vitest";
import { formatDate } from "../../src/obsidian/formatDate";

describe("formatDate", () => {
  it("formats with YYYY-MM-DD HH:mm", () => {
    const d = new Date(2026, 5, 30, 14, 3); // local time, June 30 2026 14:03
    expect(formatDate(d, "YYYY-MM-DD HH:mm")).toBe("2026-06-30 14:03");
  });
  it("zero-pads single digits", () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(formatDate(d, "YYYY-MM-DD HH:mm")).toBe("2026-01-05 09:07");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/formatDate.test.ts`
Expected: FAIL — cannot find module `formatDate`.

- [ ] **Step 3: Write `formatDate.ts`**

```ts
export function formatDate(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return fmt
    .replace("YYYY", String(d.getFullYear()))
    .replace("MM", pad(d.getMonth() + 1))
    .replace("DD", pad(d.getDate()))
    .replace("HH", pad(d.getHours()))
    .replace("mm", pad(d.getMinutes()));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/formatDate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `main.ts` send flow (depends on Task 14 ConfirmModal)**

```ts
import { Notice, Plugin, requestUrl, MarkdownView } from "obsidian";
import { deviceFor } from "./core/device";
import { compile } from "./core/compile";
import { validate, describeError } from "./core/validate";
import { autofix } from "./core/autofix";
import { render } from "./core/render";
import type { RequestFn, Transport } from "./transport/Transport";
import { LocalTransport } from "./transport/localTransport";
import { CloudTransport } from "./transport/cloudTransport";
import {
  DEFAULT_SETTINGS,
  VestaboardianSettingTab,
  type VestaboardianSettings,
} from "./obsidian/settings";
import { readMessageRegion } from "./obsidian/region";
import { appendHistory } from "./obsidian/historyWriter";
import { formatDate } from "./obsidian/formatDate";
import { ConfirmModal } from "./obsidian/ConfirmModal";

const requestAdapter: RequestFn = async (opts) => {
  const res = await requestUrl({
    url: opts.url,
    method: opts.method,
    headers: opts.headers,
    body: opts.body,
    throw: false,
  });
  // requestUrl exposes `.json` as a getter that THROWS on an empty/non-JSON
  // body (common for write responses). Access it defensively so a successful
  // POST with an empty body does not surface as a send failure.
  let json: unknown;
  try {
    json = res.json;
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text: res.text };
};

export default class VestaboardianPlugin extends Plugin {
  settings: VestaboardianSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new VestaboardianSettingTab(this.app, this));

    this.addCommand({
      id: "vestaboardian-send",
      name: "Send message from this note",
      callback: () => this.sendFromActiveNote(this.settings.defaultTransport),
    });
    this.addCommand({
      id: "vestaboardian-send-local",
      name: "Send message from this note via Local",
      callback: () => this.sendFromActiveNote("local"),
    });
    this.addCommand({
      id: "vestaboardian-send-cloud",
      name: "Send message from this note via Cloud",
      callback: () => this.sendFromActiveNote("cloud"),
    });

    this.addRibbonIcon("send", "Send to Vestaboard", () =>
      this.sendFromActiveNote(this.settings.defaultTransport),
    );
  }

  private transportFor(which: "local" | "cloud"): Transport {
    if (which === "local") {
      return new LocalTransport({
        host: this.settings.localHost,
        apiKey: this.settings.localKey,
        request: requestAdapter,
      });
    }
    return new CloudTransport({ apiKey: this.settings.cloudKey, request: requestAdapter });
  }

  private async sendFromActiveNote(which: "local" | "cloud"): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("Vestaboardian: open a note first.");
      return;
    }
    const file = view.file;
    if (!file) return;
    const device = deviceFor(this.settings.device);

    let text = await this.app.vault.read(file);
    let region = readMessageRegion(text, this.settings.marker, device.rows);
    if (!region.found) {
      new Notice(`Vestaboardian: no "${this.settings.marker}" section found.`);
      return;
    }

    let result = compile(region.message, device);
    let errors = validate(result, device);
    if (errors.length > 0) {
      if (this.settings.autofixDefault) {
        const fixed = autofix(region.message, device);
        result = compile(fixed, device);
        errors = validate(result, device);
      }
      if (errors.length > 0) {
        new Notice("Vestaboard message invalid:\n" + errors.map(describeError).join("\n"));
        return;
      }
    }

    const model = render(result.grid, device);
    const confirmed = await new Promise<boolean>((resolve) => {
      new ConfirmModal(this.app, model, device, which, resolve).open();
    });
    if (!confirmed) return;

    try {
      await this.transportFor(which).send(result.grid);
    } catch (e) {
      new Notice("Vestaboard send failed: " + (e as Error).message);
      return;
    }

    const now = formatDate(new Date(), this.settings.dateFormat);
    const updated = appendHistory(text, {
      liveAt: now,
      exitedAt: "— (live)",
      transport: which,
      message: region.message,
    });
    await this.app.vault.modify(file, updated);

    this.settings.liveState = {
      grid: result.grid,
      transport: which,
      message: region.message,
      liveAt: now,
    };
    await this.saveSettings();

    new Notice("Sent to Vestaboard.");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 6: Build to confirm it compiles**

Run: `npm run build`
Expected: `tsc --noEmit` passes and `main.js` is regenerated. (Requires Task 14's `ConfirmModal` to exist.)

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/obsidian/formatDate.ts tests/obsidian/formatDate.test.ts main.js
git commit -m "feat: wire send commands, validation, autofix, and history into plugin"
```

---

## Task 14: Confirm modal (tile preview)

**Files:**
- Create: `src/obsidian/ConfirmModal.ts`, `src/obsidian/tileGrid.ts`, `styles.css`
- Test: `tests/obsidian/tileGrid.test.ts`

**Interfaces:**
- Consumes: `RenderModel` from `render.ts`; `Device`.
- Produces:
  - `function renderTileGrid(parent: HTMLElement, model: RenderModel, device: Device): HTMLElement` (in `tileGrid.ts`) — builds a `rows × cols` DOM grid; each tile gets class `vb-tile`, a `data-color` attribute for color codes, and text content of the glyph. Shared by ConfirmModal and PreviewView so they cannot diverge.
  - `class ConfirmModal extends Modal` constructed with `(app, model, device, which, resolve)`; renders the grid, a "via {which}" label, and Send/Cancel buttons that call `resolve(true|false)` then close.

**Test approach:** `renderTileGrid` is DOM-only and testable with vitest's `jsdom` environment using a real `document`. The Modal subclass itself is verified manually.

- [ ] **Step 1: Enable jsdom for this test file and write the failing test**

`tests/obsidian/tileGrid.test.ts`:

```ts
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
```

- [ ] **Step 2: Add jsdom dev dependency**

Run: `npm install -D jsdom`
Expected: installs jsdom (vitest uses it via the `@vitest-environment jsdom` pragma).

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/tileGrid.test.ts`
Expected: FAIL — cannot find module `tileGrid`.

- [ ] **Step 4: Write `tileGrid.ts`**

```ts
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
```

- [ ] **Step 5: Write `styles.css`**

```css
.vb-grid {
  display: grid;
  grid-template-columns: repeat(var(--vb-cols), 1fr);
  gap: 2px;
  background: #111;
  padding: 6px;
  border-radius: 4px;
  max-width: 100%;
}
.vb-tile {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1c1c1c;
  color: #f0f0f0;
  font-family: var(--font-monospace);
  font-size: 0.7em;
  border-radius: 2px;
}
.vb-tile[data-color="red"] { background: #d22; }
.vb-tile[data-color="orange"] { background: #e72; }
.vb-tile[data-color="yellow"] { background: #ec3; }
.vb-tile[data-color="green"] { background: #2a6; }
.vb-tile[data-color="blue"] { background: #2557d6; }
.vb-tile[data-color="violet"] { background: #84d; }
.vb-tile[data-color="white"] { background: #eee; }
.vb-tile[data-color="black"] { background: #000; }
.vb-tile[data-color="filled"] { background: #888; }
```

- [ ] **Step 6: Write `ConfirmModal.ts`**

```ts
import { Modal, Setting, type App } from "obsidian";
import type { Device } from "../core/device";
import type { RenderModel } from "../core/render";
import { renderTileGrid } from "./tileGrid";

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private model: RenderModel,
    private device: Device,
    private which: "local" | "cloud",
    private resolve: (ok: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Send to Vestaboard" });
    renderTileGrid(contentEl, this.model, this.device);
    contentEl.createEl("p", { text: `Transport: ${this.which}` });

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("Send")
          .setCta()
          .onClick(() => {
            this.resolve(true);
            this.close();
          }),
      )
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          this.resolve(false);
          this.close();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
```

Note: `onClose` may fire after a button already resolved; resolving a promise twice is a no-op, so add a guard only if a linter complains — not required.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/tileGrid.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Update manifest to ship styles, build, commit**

esbuild does not bundle `styles.css`; Obsidian auto-loads a `styles.css` at the plugin root, so it is already in the right place.

Run: `npm run build && npx vitest run`
Expected: build succeeds; full suite passes.

```bash
git add src/obsidian/ConfirmModal.ts src/obsidian/tileGrid.ts styles.css tests/obsidian/tileGrid.test.ts main.js package.json package-lock.json
git commit -m "feat: add tile-grid renderer and pre-send confirm modal"
```

---

## Task 15: Live preview sidebar view

**Files:**
- Create: `src/obsidian/PreviewView.ts`
- Modify: `src/main.ts` (register view + command to open it)

**Interfaces:**
- Consumes: `renderTileGrid`, `compile`, `validate`/`describeError`, `render`, `readMessageRegion`, `deviceFor`, settings.
- Produces: `const VIEW_TYPE_VESTABOARD = "vestaboard-preview"`; `class PreviewView extends ItemView` that re-renders the active note's message on `active-leaf-change` and editor changes, shows validation status, and has a Send button.

This is Obsidian-glue UI; verified manually (Task 17). No new unit test (logic reuses already-tested core).

- [ ] **Step 1: Write `PreviewView.ts`**

```ts
import { ItemView, type WorkspaceLeaf, MarkdownView } from "obsidian";
import { deviceFor } from "../core/device";
import { compile } from "../core/compile";
import { validate, describeError } from "../core/validate";
import { render } from "../core/render";
import { readMessageRegion } from "./region";
import { renderTileGrid } from "./tileGrid";
import type { VestaboardianSettings } from "./settings";

export const VIEW_TYPE_VESTABOARD = "vestaboard-preview";

export class PreviewView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private settings: VestaboardianSettings,
    private onSend: () => void,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_VESTABOARD;
  }
  getDisplayText(): string {
    return "Vestaboard preview";
  }
  getIcon(): string {
    return "send";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.refresh()),
    );
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refresh()));
    this.refresh();
  }

  private refresh(): void {
    const root = this.contentEl;
    root.empty();
    const device = deviceFor(this.settings.device);

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const text = view?.editor.getValue() ?? "";
    const region = readMessageRegion(text, this.settings.marker, device.rows);

    if (!region.found) {
      root.createEl("p", { text: `No "${this.settings.marker}" section in this note.` });
      return;
    }

    const result = compile(region.message, device);
    const errors = validate(result, device);
    renderTileGrid(root, render(result.grid, device), device);

    const status = root.createEl("p");
    status.textContent = errors.length
      ? "Invalid: " + errors.map(describeError).join("; ")
      : "Valid ✓";

    const btn = root.createEl("button", { text: "Send to Vestaboard" });
    btn.disabled = errors.length > 0 && !this.settings.autofixDefault;
    btn.onclick = () => this.onSend();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
```

- [ ] **Step 2: Register the view and an open command in `main.ts`**

Add these imports to `main.ts`:

```ts
import { VIEW_TYPE_VESTABOARD, PreviewView } from "./obsidian/PreviewView";
```

Inside `onload()`, after the existing commands:

```ts
this.registerView(
  VIEW_TYPE_VESTABOARD,
  (leaf) =>
    new PreviewView(leaf, this.settings, () =>
      this.sendFromActiveNote(this.settings.defaultTransport),
    ),
);

this.addCommand({
  id: "vestaboardian-open-preview",
  name: "Open Vestaboard preview",
  callback: async () => {
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_VESTABOARD, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  },
});
```

- [ ] **Step 3: Build and run the suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds; all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/obsidian/PreviewView.ts src/main.ts main.js
git commit -m "feat: add live tile-preview sidebar view"
```

---

## Task 16: Optional polling for accurate exit times

**Files:**
- Create: `src/obsidian/poller.ts`
- Test: `tests/obsidian/poller.test.ts`
- Modify: `src/main.ts` (start/stop polling on load/settings change/send)

**Interfaces:**
- Produces:
  - `function gridsEqual(a: number[][], b: number[][]): boolean` — deep equality of two code grids.
  - `class Poller` constructed with `{ intervalMs; readState; getLiveGrid; onExit }`; `start()`/`stop()`. On each tick, if a live grid is set and `readState()` no longer equals it, calls `onExit()` once and clears the live grid until restarted.

**Test approach:** `gridsEqual` is pure and unit-tested. `Poller` timing is verified with vitest fake timers.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gridsEqual, Poller } from "../../src/obsidian/poller";

describe("gridsEqual", () => {
  it("true for identical grids", () => {
    expect(gridsEqual([[1, 2]], [[1, 2]])).toBe(true);
  });
  it("false for differing grids", () => {
    expect(gridsEqual([[1, 2]], [[1, 3]])).toBe(false);
    expect(gridsEqual([[1]], [[1, 2]])).toBe(false);
  });
});

describe("Poller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls onExit when the board no longer matches the live grid", async () => {
    let live: number[][] | null = [[1, 2]];
    const onExit = vi.fn();
    const p = new Poller({
      intervalMs: 1000,
      readState: async () => [[9, 9]], // board changed
      getLiveGrid: () => live,
      onExit: () => {
        onExit();
        live = null;
      },
    });
    p.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onExit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onExit).toHaveBeenCalledTimes(1); // not called again after cleared
    p.stop();
  });

  it("does not call onExit while the board still matches", async () => {
    const onExit = vi.fn();
    const p = new Poller({
      intervalMs: 1000,
      readState: async () => [[1, 2]],
      getLiveGrid: () => [[1, 2]],
      onExit,
    });
    p.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(onExit).not.toHaveBeenCalled();
    p.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/obsidian/poller.test.ts`
Expected: FAIL — cannot find module `poller`.

- [ ] **Step 3: Write minimal implementation**

```ts
export function gridsEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

interface PollerOpts {
  intervalMs: number;
  readState: () => Promise<number[][]>;
  getLiveGrid: () => number[][] | null;
  onExit: () => void;
}

export class Poller {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private opts: PollerOpts) {}

  start(): void {
    this.stop();
    this.timer = setInterval(() => void this.tick(), this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const live = this.opts.getLiveGrid();
    if (!live) return;
    let state: number[][];
    try {
      state = await this.opts.readState();
    } catch {
      return; // transient network errors: skip this tick
    }
    if (!gridsEqual(state, live)) {
      this.opts.onExit();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/obsidian/poller.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the poller into `main.ts`**

Add import:

```ts
import { Poller } from "./obsidian/poller";
import { floorPollInterval } from "./obsidian/settings";
```

Add a `private poller: Poller | null = null;` field. Add a method:

```ts
private restartPolling(): void {
  this.poller?.stop();
  this.poller = null;
  if (!this.settings.pollingEnabled) return;
  const intervalMs = floorPollInterval(this.settings.pollingIntervalSec) * 1000;
  this.poller = new Poller({
    intervalMs,
    readState: () =>
      this.transportFor(this.settings.liveState?.transport ?? this.settings.defaultTransport)
        .readState(),
    getLiveGrid: () => this.settings.liveState?.grid ?? null,
    onExit: async () => {
      const live = this.settings.liveState;
      if (!live) return;
      // Stamp the live row's exit in whatever note currently holds it is out of
      // scope for polling (note identity not tracked); clear live state so we
      // do not repeatedly fire. History exit is primarily handled on next post.
      this.settings.liveState = null;
      await this.saveSettings();
    },
  });
  this.poller.start();
}
```

Call `this.restartPolling()` at the end of `onload()`, after each `saveSettings()` in the send flow, and register cleanup:

```ts
this.register(() => this.poller?.stop());
```

(Per §7/§12, the primary exit stamp is infer-on-next-post; polling here guards against externally-changed boards by clearing stale live state. Keeping note-targeted exit stamping out of polling avoids tracking note identity across restarts.)

- [ ] **Step 6: Build and run the suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/obsidian/poller.ts tests/obsidian/poller.test.ts src/main.ts main.js
git commit -m "feat: add optional board polling to detect external changes"
```

---

## Task 17: Beta polish — README, manual verification, BRAT readiness

**Files:**
- Create: `README.md`
- Verify: full build + suite; manual smoke in Obsidian.

This task has no unit tests; it is documentation plus a manual verification checklist.

- [ ] **Step 1: Write `README.md`**

```markdown
# Vestaboardian

Compose a message in an Obsidian note and send it to your Vestaboard.

## Install (beta, via BRAT)

1. Install the BRAT community plugin.
2. BRAT → "Add a beta plugin" → `patrick-knight/Vestaboardian`.
3. Enable Vestaboardian in Community Plugins.

## Setup

Open Settings → Vestaboardian:
- **Device:** Flagship (6×22) or Note (3×15).
- **Default transport:** Cloud (Read/Write API) or Local (LAN).
- **Cloud:** paste your Read/Write API key.
- **Local:** set host (default `vestaboard.local`) and Local API key.

> Tokens are stored in plaintext in this vault's `data.json`.

## Use

Add a `## Vestaboard` section to any note:

\`\`\`
## Vestaboard
🟦 STANDUP IN 🟦
10 MINUTES
\`\`\`

Run **"Vestaboard: Send message from this note"** (command palette or ribbon).
A preview confirms before sending. A `## Vestaboard History` table records when
each message went live and when it left the board.

## Colors

Use emoji for colored tiles: 🟥 🟧 🟨 🟩 🟦 🟪 ⬜ ⬛ (and ❤️ → code 62).
```

- [ ] **Step 2: Full clean verification**

Run: `rm -rf node_modules && npm install && npm run build && npx vitest run`
Expected: install succeeds; `main.js` regenerated; **all test files pass** with zero failures.

- [ ] **Step 3: Manual smoke test in Obsidian**

Document the steps performed (no code):
1. Copy `main.js`, `manifest.json`, `styles.css` into a test vault's `.obsidian/plugins/vestaboardian/`.
2. Enable the plugin; open Settings and set a device + a transport key.
3. Create a note with a `## Vestaboard` section; open the preview view; confirm tiles render and validation status updates as you type.
4. Run the send command; confirm the modal preview matches; Send; confirm a history row appears with a live timestamp.
5. (If a board/key available) confirm the physical board updates.

Record the outcome in the commit message / PR description.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README and BRAT install instructions"
```

---

## Self-Review

**Spec coverage** (§ from design spec → task):
- §2 compose in note → Tasks 11, 13. Flagship+Note device-aware → Tasks 2, 4, 5, 7. Validation blocks + auto-fix → Tasks 5, 6, 13. Colored tiles via emoji → Tasks 3, 4, 7, 14. Both transports + default/override → Tasks 8, 9, 13. Tile-accurate preview (sidebar + modal) → Tasks 14, 15. Chronological history with live/exit → Tasks 12, 13, 16. ✓
- §4 character codes / §8 compiler/validate/autofix → Tasks 3–6 (constants verified against docs.vestaboard.com). ✓
- §5 architecture (pure core, transport, obsidian) → file structure + task split mirrors it. ✓
- §6 region + history format → Tasks 11, 12. ✓
- §7 send flow steps 1–8 → Task 13 (steps 1–7) + Task 16 (step 8 polling). ✓
- §9 transports incl. enablement helper → Task 8 (`LocalTransport.enable`), Task 9. ✓
- §10 settings (all fields incl. polling floor, plaintext note) → Task 10. ✓
- §11 preview shared renderer → Task 14 `tileGrid` shared by Tasks 14, 15. ✓
- §13 testing strategy (core unit no-mocks; transport mocked requestUrl; light glue) → Tasks 2–9, 11, 12. ✓
- §14 distribution (esbuild, manifest, versions, committed main.js, BRAT) → Tasks 1, 17. ✓
- §15 build sequence → task order matches (scaffold → core → transport → glue → preview → polling → polish). ✓

**Known deviations from spec, intentional:**
- §7 step 8 exit stamping via polling: this plan's poller clears stale live-state rather than editing a specific note's table, because note identity isn't tracked across restarts. Infer-on-next-post (Task 12) remains the authoritative exit stamp, consistent with §12's stated limitations. If precise polled exit stamping into the note is required, it needs a follow-up that persists the live note path in `liveState`.
- Default transport defaults to `cloud` (spec §10 lists Local|Cloud without a stated default). Adjustable in one line.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Each code step shows complete code. (Task 13 references `ConfirmModal` from Task 14 with an explicit ordering note.)

**Type consistency:** `Transport`/`RequestFn` signatures identical across Tasks 8, 9, 13. `RenderModel`/`Tile` consistent Tasks 7, 14, 15. `VestaboardianSettings`/`LiveState` consistent Tasks 10, 13, 16. `appendHistory`/`HistoryRow` consistent Tasks 12, 13. `readMessageRegion` signature consistent Tasks 11, 13, 15.

**Task ordering note for executor:** Build Task 14 (`ConfirmModal`/`tileGrid`) before Task 13's `main.ts` modal wiring step (Task 13 Step 5). All other tasks are in dependency order.
