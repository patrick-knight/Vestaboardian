# Vestaboardian

Compose a message in an Obsidian note and send it to your
[Vestaboard](https://www.vestaboard.com/) split-flap display — with a live tile
preview, validation, one-click auto-fix, and a message history table kept right
in your note.

## Features at a glance

- **Send from any note** — write your message under a `## Vestaboard` heading
  and send it with one command or the ribbon button.
- **Live tile preview** — a right-sidebar view renders your message as
  Vestaboard tiles while you type, with validation status.
- **Confirm before sending** — a modal shows exactly what the board will
  display before anything is transmitted.
- **Validation and auto-fix** — unsupported characters, over-wide rows, and
  extra rows are caught with precise errors, or normalized automatically.
- **Color tiles** — emoji squares (🟥 🟧 🟨 🟩 🟦 🟪 ⬜ ⬛) become colored
  Vestaboard tiles.
- **History table** — each send is logged in a `## Vestaboard History` table in
  the note, newest first, including when the message left the board.
- **Two transports** — Vestaboard Cloud Read/Write API (works from anywhere)
  or the Local API (LAN only, no cloud round-trip).
- **Both devices** — Flagship (6 rows × 22 columns) and Note (3 × 15).

## Status

**Beta.** The plugin builds cleanly and its logic is covered by 74 unit tests,
but it has had limited testing inside a running Obsidian instance and against
physical boards. Please report issues on this repo. Desktop only for now.

## Requirements

- A Vestaboard (Flagship or Note) that is paired and online.
- Obsidian 1.5.0 or newer (desktop).
- An API key for at least one transport — see
  [Getting your API keys](#getting-your-api-keys) below.

## Installation

### Via BRAT (recommended while in beta)

1. In Obsidian, open **Settings → Community plugins**, select **Browse**, and
   install **BRAT** (Beta Reviewer's Auto-update Tool). Enable it.
2. Open **Settings → BRAT**, select **Add beta plugin**.
3. Enter the repository: `patrick-knight/Vestaboardian`. Leave the version
   field empty to track the latest release.
4. Select **Add plugin**. BRAT downloads and installs it.
5. Go back to **Settings → Community plugins** and make sure **Vestaboardian**
   is enabled.

BRAT will keep the plugin updated as new releases are published.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest release](https://github.com/patrick-knight/Vestaboardian/releases/latest).
2. Create the folder `<your vault>/.obsidian/plugins/vestaboardian/` and copy
   the three files into it.
3. In Obsidian, open **Settings → Community plugins**, refresh the list, and
   enable **Vestaboardian**.

## Getting your API keys

You only need the key for the transport you plan to use. Cloud is the simplest
to set up.

### Cloud Read/Write API key

1. Sign in at [web.vestaboard.com](https://web.vestaboard.com) (or use the
   Vestaboard mobile app).
2. Open the **Developer** section (web app) or **Settings → API tokens**
   (mobile app).
3. Create a new **Read/Write** API key.
4. **Copy the key immediately** — Vestaboard shows it only once. If you lose
   it, revoke it and create a new one.

### Local API key

The Local API lets the plugin talk directly to the board over your LAN. It
requires a one-time enablement:

1. Request a **Local API enablement token** from Vestaboard at
   [vestaboard.com/local-api](https://www.vestaboard.com/local-api). Your board
   must be paired, online, and up to date. The token arrives by email.
2. In **Settings → Vestaboardian**, paste the token into **Enable Local API**
   and press **Enable** (your computer must be on the same network as the
   board). The plugin exchanges it with the board for the permanent key and
   stores it automatically. Alternatively, do the same by hand:

   ```sh
   curl -X POST \
     -H "X-Vestaboard-Local-Api-Enablement-Token: YOUR_ENABLEMENT_TOKEN" \
     http://vestaboard.local:7000/local-api/enablement
   ```

   and paste the returned `apiKey` into the **Local API key** setting.
3. If `vestaboard.local` does not resolve on your network, find the board's IP
   address in your router's client list and put that in the plugin's
   **Local host** setting first.

> **Token storage note:** the plugin stores your keys in plaintext in this
> vault's `.obsidian/plugins/vestaboardian/data.json`. They stay in your vault
> and are never sent anywhere except to Vestaboard's API (Cloud) or your board
> (Local). Keep this in mind if you sync or share your vault.

## Configuring the plugin

Open **Settings → Vestaboardian**:

| Setting | What it does | Default |
| --- | --- | --- |
| **Device** | Flagship (6×22) or Note (3×15). Controls grid size, validation, and preview. | Flagship |
| **Default transport** | Which API the send command and ribbon button use. | Cloud |
| **Cloud Read/Write key** | The key from the Developer section (see above). | — |
| **Local host** | Hostname or IP of your board on the LAN. | `vestaboard.local` |
| **Local API key** | The `apiKey` returned by the enablement request (see above). | — |
| **Enable Local API** | Paste your enablement token and press Enable to fetch and store the key automatically. | — |
| **Message marker heading** | The heading the plugin looks for in a note to find your message. | `## Vestaboard` |
| **Auto-fix by default** | If a message is invalid, silently normalize it (drop unsupported characters, truncate over-wide rows, trim extra rows) instead of blocking. | On |
| **Poll the board for exit times** | Periodically read the board and clear the plugin's "currently live" state if the board was changed elsewhere (e.g. from the mobile app). | Off |
| **Poll interval** | Seconds between polls; minimum 15. | 30 |
| **History date format** | Timestamp format for history rows. Tokens: `YYYY`, `MM`, `DD`, `HH`, `mm`. | `YYYY-MM-DD HH:mm` |

## Usage

### 1. Write a message

Add the marker heading (default `## Vestaboard`) anywhere in a note, with your
message on the lines below it:

```markdown
## Vestaboard
🟦 STANDUP IN 🟦
10 MINUTES
```

The message is the block from the first non-blank line after the heading up to
the next blank line, heading, or end of file — capped at the device's row
count. Text is case-insensitive (the board is uppercase-only); each character
and each color emoji occupies one tile.

### 2. Preview it (optional)

Run **Open Vestaboard preview** from the command palette. A right-sidebar view
shows the tile rendering live as you type, plus a validation status line and a
Send button.

### 3. Send it

Run **Send message from this note** (command palette or the send ribbon
icon). A confirmation modal shows the exact tiles; select **Send**. To
override the default transport for a single send, use **Send message from
this note via Local** or **… via Cloud** instead.

If the message is invalid and auto-fix is off, the send is blocked with a
Notice describing each problem (row, column, and character).

### Commands

| Command | Action |
| --- | --- |
| **Send message from this note** | Compile, validate, confirm, and send via the default transport. |
| **Send message from this note via Local** | Same, forcing the Local transport. |
| **Send message from this note via Cloud** | Same, forcing the Cloud transport. |
| **Open Vestaboard preview** | Open the live tile preview in the right sidebar. |

### Colors and special characters

Use emoji for colored tiles, one tile each:

🟥 red · 🟧 orange · 🟨 yellow · 🟩 green · 🟦 blue · 🟪 violet · ⬜ white ·
⬛ black · ❤️ → character code 62 (renders as ° on Flagship, ♥ on Note).

Supported text: letters, digits, space, and `!@#$()-+&=;:'"%,./?`. Anything
else is flagged by validation (or dropped by auto-fix).

### History

After each successful send, the plugin appends a row to a
`## Vestaboard History` table in the same note (creating the table if needed):

```markdown
## Vestaboard History
| Live (sent) | Exited | Transport | Message |
| --- | --- | --- | --- |
| 2026-07-05 09:30 | — (live) | cloud | STANDUP IN 10 MIN… |
```

The **Exited** time for the previous message is stamped when you post the next
one (infer-on-next-post). If polling is enabled, the plugin also notices when
the board is changed from elsewhere and clears its "currently live" state; the
authoritative exit timestamp still comes from the next post.

## Troubleshooting

- **"No `## Vestaboard` section found"** — the note needs the marker heading
  exactly as configured in settings (default `## Vestaboard`), and the message
  must start within the same section (blank lines directly after the heading
  are skipped).
- **Cloud send fails with 401/403** — the Read/Write key is wrong or was
  revoked. Create a new key in the Developer section and paste it into
  settings.
- **Local send fails or times out** — confirm the board and computer are on
  the same network, and try the board's IP address in **Local host** instead
  of `vestaboard.local` (mDNS does not resolve on some networks). Verify the
  Local API was enabled (step 2 of the key setup).
- **Message looks different on the board** — auto-fix may have normalized it.
  The history row records what was actually sent. Turn **Auto-fix by default**
  off to be shown validation errors instead.
- **Preview shows the wrong grid size** — check the **Device** setting matches
  your board model.

## Development

```sh
npm install
npm run build   # tsc --noEmit && esbuild -> main.js
npm test        # vitest unit suite
```

Pure logic lives in `src/core/` (no Obsidian imports), transports in
`src/transport/`, and the Obsidian glue in `src/obsidian/`. `main.js` is
committed because BRAT and manual installs consume it directly.

## Disclaimer

This is an unofficial community plugin. It is not created by, affiliated with,
or supported by Vestaboard, Inc.

## License

[MIT](LICENSE)
