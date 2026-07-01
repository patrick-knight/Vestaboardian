# Vestaboardian

Compose a message in an Obsidian note and send it to your [Vestaboard](https://www.vestaboard.com/).

## Status

**Beta.** The plugin builds cleanly (`tsc` + esbuild) and its pure logic —
character-code compiler, validation, auto-fix, grid renderer, both transports,
region reader, history writer, date formatter, and poller — is covered by 63
unit tests. It has **not yet been loaded in a running Obsidian instance or sent
to a physical board.** The Obsidian glue (plugin entry, settings tab, preview
sidebar, confirm modal) is type-checked against Obsidian's API but exercised
only manually. Run the [manual verification checklist](#manual-verification-not-yet-run)
before relying on it, and report issues on the repo.

## Install (beta, via BRAT)

1. Install the BRAT community plugin.
2. BRAT → "Add a beta plugin" → `patrick-knight/Vestaboardian`.
3. Enable Vestaboardian in Community Plugins.

## Setup

Open Settings → Vestaboardian:

- **Device:** Flagship (6×22) or Note (3×15).
- **Default transport:** Cloud (Read/Write API) or Local (LAN).
- **Cloud:** paste your Read/Write API key (from the Vestaboard Developer section).
- **Local:** set host (default `vestaboard.local`) and Local API key.

> Tokens are stored in plaintext in this vault's
> `.obsidian/plugins/vestaboardian/data.json`. They live in your vault, never in
> this source repo.

## Use

Add a `## Vestaboard` section to any note:

```
## Vestaboard
🟦 STANDUP IN 🟦
10 MINUTES
```

The message is the block from the first non-blank line after the heading up to
the next blank line, heading, or end of file — capped at the device's row count.

Run **"Vestaboard: Send message from this note"** (command palette or the ribbon
icon). A tile preview confirms before sending. Use **"…via Local"** / **"…via
Cloud"** to override the default transport for one send. Invalid messages are
blocked with precise errors; if auto-fix is enabled they are normalized (dropped
unsupported characters, truncated over-wide rows, trimmed extra rows) and
re-validated automatically.

A `## Vestaboard History` table (created if absent, newest-first) records when
each message went live and — inferred on the next post, or via optional polling
— when it left the board. The timestamp format is configurable.

Run **"Open Vestaboard preview"** for a live right-sidebar tile preview that
re-renders as you type, with validation status and a Send button.

## Colors

Use emoji for colored tiles, one tile each:

🟥 red · 🟧 orange · 🟨 yellow · 🟩 green · 🟦 blue · 🟪 violet · ⬜ white ·
⬛ black · ❤️ → code 62 (shows ° on Flagship, ♥ on Note).

## Manual verification (not yet run)

This checklist has **not** been executed — it is the acceptance test for the
beta:

1. Copy `main.js`, `manifest.json`, and `styles.css` into a test vault's
   `.obsidian/plugins/vestaboardian/`.
2. Enable the plugin; open Settings and set a device + a transport key.
3. Create a note with a `## Vestaboard` section; open the preview view; confirm
   tiles render and validation status updates as you type.
4. Run the send command; confirm the modal preview matches the sidebar; press
   Send; confirm a history row appears with a live timestamp.
5. Dismiss the confirm modal with Escape and confirm the send cleanly cancels
   (no hang).
6. (With a board/key available) confirm the physical board updates over both the
   Local and Cloud transports, and that `readState` returns the current grid.

## Build

```
npm install
npm run build   # tsc --noEmit && esbuild -> main.js
npx vitest run  # unit tests
```

`main.js` is committed (BRAT installs it directly); `node_modules` and each
vault's `data.json` are git-ignored.
