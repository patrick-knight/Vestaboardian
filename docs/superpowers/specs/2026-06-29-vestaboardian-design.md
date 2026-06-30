# Vestaboardian — Design Spec

**Date:** 2026-06-29
**Status:** Approved for implementation planning
**Repo:** github.com/patrick-knight/Vestaboardian (public)

## 1. Summary

Vestaboardian is an Obsidian plugin that sends a message composed in a note to a
[Vestaboard](https://docs.vestaboard.com/) physical display. The message is read
from a marked region of the note, compiled to the board's native character-code
grid, validated and rendered as a tile-accurate preview, and posted over either
the cloud Read/Write API or the LAN Local API. The note keeps a chronological
history of what went live and when it left the board.

## 2. Goals

- Compose a Vestaboard message inside an ordinary Obsidian note.
- Support both **Vestaboard Flagship (6×22)** and **Vestaboard Note (3×15)**;
  validation and rendering are device-aware.
- Validate the message against the device's VBML/character-code rules; **block**
  invalid sends with precise errors, offer **one-click auto-fix**.
- Support **colored tiles via emoji** in otherwise-literal text.
- Send over **both** the cloud Read/Write API and the LAN Local API, choosing a
  **configured default transport with a per-send override**.
- Show a **tile-accurate preview** both as a live sidebar view and a pre-send
  confirmation modal.
- Maintain a **chronological history** in the note: message + time it went live +
  time it exited the board.

## 3. Non-goals (v1)

- Creating a new note from a template ("new Vestaboard note" command) — later.
- Transitions / animations (the Local API's `strategy`/`step_interval_ms` form).
- Managing multiple boards from one vault.
- Scheduling / queued / timed messages.
- Encrypted credential storage beyond Obsidian's standard `data.json`.

## 4. Domain facts (from Vestaboard docs)

- **Grids:** Flagship = 6 rows × 22 cols; Note = 3 rows × 15 cols.
- **Character codes 0–71.** `0`=blank space; `1–26`=A–Z; `27–35`=1–9; `36`=0;
  punctuation set: `!`=37 `@`=38 `#`=39 `$`=40 `(`=41 `)`=42 `-`=44 `+`=46 `&`=47
  `=`=48 `;`=49 `:`=50 `'`=52 `"`=53 `%`=54 `,`=55 `.`=56 `/`=59 `?`=60 `°`=62;
  color tiles `63`=red `64`=orange `65`=yellow `66`=green `67`=blue `68`=violet
  `69`=white `70`=black `71`=filled. Lowercase auto-uppercases. `62` shows ° on
  Flagship and ♥ on Note.
- **Cloud Read/Write API:** token-based (key from the Vestaboard app/web
  Developer section), accepts VBML text *or* a character-code array, and can
  **read** current board state.
- **Local API:** accepts **only character-code arrays** (no VBML).
  - Enablement: request an enablement token via form at vestaboard.com/local-api;
    receive it by email; one-time `POST http://vestaboard.local:7000/local-api/enablement`
    with header `X-Vestaboard-Local-Api-Enablement-Token` returns a persistent
    `apiKey`.
  - Read: `GET http://<host>:7000/local-api/message`, header
    `X-Vestaboard-Local-Api-Key`.
  - Write: `POST http://<host>:7000/local-api/message`, same header, body = 6×22
    (or 3×15) array of arrays of character codes. IPv4 required.

**Implication:** because the Local API takes only character-code arrays, the
plugin owns a **text→grid compiler**. That same compiler output is what the cloud
transport sends and what the preview renders — one source of truth.

## 5. Architecture

A pure, dependency-free **core** wrapped by thin **transport** and **Obsidian**
adapters. The core has no Obsidian or network imports and is fully unit-testable.

```
src/
  core/                 (pure)
    device.ts           device specs: { rows, cols, name } for Flagship / Note
    glyphMap.ts         char + emoji → Vestaboard code (0–71); reverse map for render
    compile.ts          message text → number[][] grid (rows of codes)
    validate.ts         device-aware checks → typed errors
    autofix.ts          normalize a message/grid so it re-validates
    render.ts           grid → preview model (per-tile code + color)
  transport/
    Transport.ts        interface { send(grid): Promise<void>; readState(): Promise<number[][]> }
    localTransport.ts   Local API via Obsidian requestUrl
    cloudTransport.ts   Read/Write API via Obsidian requestUrl
  obsidian/
    main.ts             plugin entry; commands, ribbon, lifecycle
    settings.ts         SettingsTab + settings data model (persisted to data.json)
    region.ts           locate + read the `## Vestaboard` message region in a note
    historyWriter.ts    create/maintain the `## Vestaboard History` table
    poller.ts           optional polling for accurate exit detection
    PreviewView.ts      live right-sidebar ItemView rendering tiles
    ConfirmModal.ts     pre-send Modal rendering tiles + Send/Cancel
manifest.json
versions.json
main.js                 (esbuild output)
```

All HTTP uses Obsidian's `requestUrl` to avoid Electron CORS for both LAN and
cloud endpoints.

## 6. Message region & note format

### Message region
- Marked by a `## Vestaboard` heading (the marker may appear anywhere in the note,
  which is how an "alternative position" is chosen).
- The message = the **block** starting at the first non-blank line after the marker
  and ending at the next blank line (or the next heading / end of file), capped at
  the device's row count.
- Each line is one board row. Color emojis sit inline where a colored tile should
  appear.

Example:
```
## Vestaboard
🟦 STANDUP IN 🟦
10 MINUTES

(this blank line ends the message)
```

### History section
- A `## Vestaboard History` heading the plugin creates if absent and only edits
  within (never touches surrounding prose).
- A Markdown table, newest first:

```
## Vestaboard History
| Live (sent)      | Exited           | Transport | Message            |
|------------------|------------------|-----------|--------------------|
| 2026-06-29 14:03 | 2026-06-29 15:10 | local     | STANDUP IN 10 MIN… |
| 2026-06-29 15:10 | — (live)         | cloud     | LUNCH 🟩            |
```
- Timestamp format is configurable in settings.

## 7. Send flow

1. User invokes **"Vestaboard: Send message from this note"** (command palette,
   ribbon icon, or the sidebar Send button).
2. `region.ts` locates `## Vestaboard` and reads the message block.
3. `compile.ts` produces a `number[][]` grid for the configured device.
4. `validate.ts` checks the grid. On any error: **block**, surface the typed
   errors in a notice/modal, and offer **one-click auto-fix** (`autofix.ts`) →
   recompile → re-validate.
5. `ConfirmModal` shows the tile render with Send / Cancel.
6. On Send: post via the **configured default transport**, unless the user used
   the per-send override command ("…via Local" / "…via Cloud").
7. On success, `historyWriter.ts`:
   - Stamps the new row `Live = now`, `Exited = — (live)`.
   - If a previous row was live (tracked in `data.json`), stamps its
     `Exited = now` (**infer-on-next-post**).
   - Persists the current live message + grid + transport to `data.json` so
     inference survives Obsidian restarts.
8. If **polling** is enabled, `poller.ts` periodically `readState()`s the board;
   when the live grid no longer matches what we posted, it stamps the real
   `Exited` time (catches changes made from the mobile app or elsewhere).

## 8. Compiler, validation, auto-fix

### glyphMap
- Forward: supported letters/digits/punctuation (uppercased) and recognized
  emojis → codes. Reverse: code → display glyph + color for rendering.
- Emoji → tile: 🟥→63, 🟧→64, 🟨→65, 🟩→66, 🟦→67, 🟪→68, ⬜→69, ⬛→70, ❤️→62.
  Each recognized emoji maps to exactly one tile (width 1).

### compile
- Split the message into lines; each line → an array of codes via glyphMap.
- Pad/track to device width; record over-width and unsupported positions for
  validation (do not silently truncate here).

### validate → typed errors
- `RowTooWide { row, length, max }`
- `TooManyRows { got, max }`
- `UnsupportedChar { char, row, col }`
Errors carry locations so messages read like "row 2 is 25/22" / "character 'ñ' at
row 1 col 4 is not supported."

### autofix (opt-in per error class)
- Uppercase letters; drop or replace unsupported characters; truncate over-wide
  rows to the device width; drop rows beyond the device height. Output must
  re-validate cleanly.

## 9. Transports

Common interface:
```ts
interface Transport {
  send(grid: number[][]): Promise<void>;
  readState(): Promise<number[][]>;
}
```
- **localTransport:** `POST/GET http://<host>:7000/local-api/message`, header
  `X-Vestaboard-Local-Api-Key`. Optional helper to run the one-time enablement
  call given a pasted enablement token. IPv4/`vestaboard.local` host configurable.
- **cloudTransport:** Read/Write API with the account's read-write key; sends the
  character-code array (the same grid), and `readState()` reads current board.

Transport selection: a configured default; per-send override via dedicated
commands. Errors (unreachable LAN, 4xx/5xx, auth) surface as Obsidian notices and
abort the history stamp.

## 10. Settings (persisted to `data.json`)

- **Device:** Flagship (6×22) | Note (3×15).
- **Default transport:** Local | Cloud.
- **Cloud:** Read/Write API key.
- **Local:** host (default `vestaboard.local`), local API key, optional enablement
  helper.
- **Message marker:** heading text (default `## Vestaboard`).
- **Auto-fix default:** on/off.
- **Polling:** on/off + interval seconds (**floored**, e.g. ≥15s, to respect API
  and physical flip rate limits).
- **History date format.**
- A one-line note in the settings UI that tokens are stored in plaintext in
  `data.json`.

## 11. Preview

Both surfaces consume the same `render.ts` output so they can never disagree with
what is posted:
- **PreviewView** — a right-sidebar `ItemView` that re-renders the active note's
  message as colored tiles on edit, with live validation status and a Send button.
- **ConfirmModal** — the same renderer shown on send with Send / Cancel.

Rendering draws a `rows × cols` grid of tiles; color codes paint the tile
background, character codes draw the split-flap glyph (CSS, no images required).

## 12. Known limitations

- Obsidian must be **open** to send or poll; exit timestamps have gaps when it is
  closed. The currently-live message is persisted in `data.json` so inference
  survives restarts.
- Polling interval is floored to respect rate limits; exit times are therefore
  accurate only to within one interval.
- `data.json` holds tokens in plaintext (standard for Obsidian plugins). It lives
  in the user's vault (`.obsidian/plugins/vestaboardian/data.json`), not in this
  source repo, so credentials never reach the public repo by construction.

## 13. Testing strategy

- **Core (unit, no mocks):** glyphMap round-trips; compile of literal text,
  emoji tiles, multi-line blocks for both devices; validate produces the right
  typed errors at the right locations; autofix output always re-validates; render
  model matches expected tiles.
- **Transport (mocked `requestUrl`):** correct URL/method/headers/body for local
  and cloud send + readState; error propagation.
- **Obsidian glue (light):** region extraction from sample notes (marker present,
  absent, with/without trailing blank line, capped at grid height); historyWriter
  creates/updates the table without touching prose; infer-exit stamping logic.

## 14. Distribution

- TypeScript + esbuild; `manifest.json` + `versions.json`; build emits `main.js`.
- BRAT-installable directly from the public GitHub repo for beta testing before
  any community-plugin submission.

## 15. Build sequence (high level)

1. Repo scaffold: `manifest.json`, `package.json`, esbuild config, tsconfig,
   `.gitignore` (ignores `node_modules`; **does not** ignore the built `main.js`,
   which BRAT requires to be committed). Note: plugin secrets live in each vault's
   `.obsidian/plugins/.../data.json`, never in this repo, so there is nothing
   credential-bearing to ignore here.
2. Core: device → glyphMap → compile → validate → autofix → render, with tests.
3. Transports with mocked-request tests.
4. Obsidian glue: settings, region reader, send command, history writer.
5. Preview: ConfirmModal, then PreviewView.
6. Optional polling.
7. Beta polish + BRAT manifest; push public repo.
