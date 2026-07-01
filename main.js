"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => VestaboardianPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/core/device.ts
var FLAGSHIP = { name: "flagship", rows: 6, cols: 22 };
var NOTE = { name: "note", rows: 3, cols: 15 };
function deviceFor(name) {
  return name === "note" ? NOTE : FLAGSHIP;
}

// src/core/validate.ts
function validate(result, device) {
  const errors = [];
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
      col: issue.col
    });
  }
  return errors;
}
function describeError(e) {
  switch (e.kind) {
    case "RowTooWide":
      return `row ${e.row + 1} is ${e.length}/${e.max} wide`;
    case "TooManyRows":
      return `${e.got} rows exceeds the ${e.max}-row board`;
    case "UnsupportedChar":
      return `character '${e.char}' at row ${e.row + 1} col ${e.col + 1} is not supported`;
  }
}

// src/core/glyphMap.ts
var BLANK = 0;
var CHAR_TO_CODE = /* @__PURE__ */ new Map();
CHAR_TO_CODE.set(" ", 0);
for (let i = 0; i < 26; i++) {
  CHAR_TO_CODE.set(String.fromCharCode(65 + i), 1 + i);
}
for (let d = 1; d <= 9; d++) {
  CHAR_TO_CODE.set(String(d), 26 + d);
}
CHAR_TO_CODE.set("0", 36);
var PUNCT = [
  ["!", 37],
  ["@", 38],
  ["#", 39],
  ["$", 40],
  ["(", 41],
  [")", 42],
  ["-", 44],
  ["+", 46],
  ["&", 47],
  ["=", 48],
  [";", 49],
  [":", 50],
  ["'", 52],
  ['"', 53],
  ["%", 54],
  [",", 55],
  [".", 56],
  ["/", 59],
  ["?", 60]
];
for (const [ch, code] of PUNCT) CHAR_TO_CODE.set(ch, code);
function charToCode(ch) {
  if (ch.length === 0) return void 0;
  const upper = ch.toUpperCase();
  return CHAR_TO_CODE.get(upper);
}
var EMOJI_TO_CODE = /* @__PURE__ */ new Map([
  ["\u{1F7E5}", 63],
  ["\u{1F7E7}", 64],
  ["\u{1F7E8}", 65],
  ["\u{1F7E9}", 66],
  ["\u{1F7E6}", 67],
  ["\u{1F7EA}", 68],
  ["\u2B1C", 69],
  ["\u2B1B", 70],
  ["\u2764\uFE0F", 62]
]);
function isColorCode(code) {
  return code >= 63 && code <= 71;
}
var CODE_TO_GLYPH = /* @__PURE__ */ new Map();
for (const [ch, code] of CHAR_TO_CODE) CODE_TO_GLYPH.set(code, ch);
function codeToGlyph(code, device) {
  if (code === 0) return " ";
  if (code === 62) return device === "note" ? "\u2665" : "\xB0";
  if (isColorCode(code)) return "";
  const glyph = CODE_TO_GLYPH.get(code);
  return glyph != null ? glyph : "?";
}

// src/core/render.ts
var COLOR_NAME = {
  63: "red",
  64: "orange",
  65: "yellow",
  66: "green",
  67: "blue",
  68: "violet",
  69: "white",
  70: "black",
  71: "filled"
};
function tile(code, device) {
  var _a;
  return {
    code,
    glyph: codeToGlyph(code, device.name),
    colorName: isColorCode(code) ? (_a = COLOR_NAME[code]) != null ? _a : null : null
  };
}
function render(grid, device) {
  var _a, _b;
  const model = [];
  for (let r = 0; r < device.rows; r++) {
    const srcRow = (_a = grid[r]) != null ? _a : [];
    const row = [];
    for (let c = 0; c < device.cols; c++) {
      row.push(tile((_b = srcRow[c]) != null ? _b : 0, device));
    }
    model.push(row);
  }
  return model;
}

// src/transport/localTransport.ts
var LocalTransport = class {
  constructor(opts) {
    this.opts = opts;
  }
  url() {
    return `http://${this.opts.host}:7000/local-api/message`;
  }
  async send(grid) {
    const res = await this.opts.request({
      url: this.url(),
      method: "POST",
      headers: {
        "X-Vestaboard-Local-Api-Key": this.opts.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(grid)
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Local API send failed: ${res.status} ${res.text}`);
    }
  }
  async readState() {
    var _a;
    const res = await this.opts.request({
      url: this.url(),
      method: "GET",
      headers: { "X-Vestaboard-Local-Api-Key": this.opts.apiKey }
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Local API read failed: ${res.status} ${res.text}`);
    }
    if (Array.isArray(res.json)) return res.json;
    const body = res.json;
    return (_a = body.message) != null ? _a : [];
  }
  static async enable(host, enablementToken, request) {
    const res = await request({
      url: `http://${host}:7000/local-api/enablement`,
      method: "POST",
      headers: { "X-Vestaboard-Local-Api-Enablement-Token": enablementToken }
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Enablement failed: ${res.status} ${res.text}`);
    }
    return res.json.apiKey;
  }
};

// src/transport/cloudTransport.ts
var BASE = "https://rw.vestaboard.com/";
var CloudTransport = class {
  constructor(opts) {
    this.opts = opts;
  }
  async send(grid) {
    const res = await this.opts.request({
      url: BASE,
      method: "POST",
      headers: {
        "X-Vestaboard-Read-Write-Key": this.opts.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(grid)
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Cloud API send failed: ${res.status} ${res.text}`);
    }
  }
  async readState() {
    var _a;
    const res = await this.opts.request({
      url: BASE,
      method: "GET",
      headers: { "X-Vestaboard-Read-Write-Key": this.opts.apiKey }
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Cloud API read failed: ${res.status} ${res.text}`);
    }
    const body = res.json;
    const layout = (_a = body.currentMessage) == null ? void 0 : _a.layout;
    return layout ? JSON.parse(layout) : [];
  }
};

// src/obsidian/settings.ts
var import_obsidian = require("obsidian");
var MIN_POLL_SEC = 15;
var DEFAULT_SETTINGS = {
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
  liveState: null
};
function floorPollInterval(sec) {
  return Math.max(MIN_POLL_SEC, Math.floor(sec));
}
var VestaboardianSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, host) {
    super(app, host);
    this.host = host;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.host.settings;
    new import_obsidian.Setting(containerEl).setName("Device").addDropdown(
      (d) => d.addOption("flagship", "Flagship (6\xD722)").addOption("note", "Note (3\xD715)").setValue(s.device).onChange(async (v) => {
        s.device = v;
        await this.host.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default transport").addDropdown(
      (d) => d.addOption("cloud", "Cloud (Read/Write API)").addOption("local", "Local (LAN API)").setValue(s.defaultTransport).onChange(async (v) => {
        s.defaultTransport = v;
        await this.host.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Cloud Read/Write key").addText(
      (t) => t.setValue(s.cloudKey).onChange(async (v) => {
        s.cloudKey = v.trim();
        await this.host.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Local host").addText(
      (t) => t.setValue(s.localHost).onChange(async (v) => {
        s.localHost = v.trim();
        await this.host.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Local API key").addText(
      (t) => t.setValue(s.localKey).onChange(async (v) => {
        s.localKey = v.trim();
        await this.host.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Message marker heading").addText(
      (t) => t.setValue(s.marker).onChange(async (v) => {
        s.marker = v.trim() || "## Vestaboard";
        await this.host.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Auto-fix by default").addToggle(
      (t) => t.setValue(s.autofixDefault).onChange(async (v) => {
        s.autofixDefault = v;
        await this.host.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Poll the board for exit times").addToggle(
      (t) => t.setValue(s.pollingEnabled).onChange(async (v) => {
        s.pollingEnabled = v;
        await this.host.saveSettings();
        this.host.restartPolling();
      })
    );
    new import_obsidian.Setting(containerEl).setName(`Poll interval (seconds, min ${MIN_POLL_SEC})`).addText(
      (t) => t.setValue(String(s.pollingIntervalSec)).onChange(async (v) => {
        s.pollingIntervalSec = floorPollInterval(Number(v) || MIN_POLL_SEC);
        await this.host.saveSettings();
        this.host.restartPolling();
      })
    );
    new import_obsidian.Setting(containerEl).setName("History date format").addText(
      (t) => t.setValue(s.dateFormat).onChange(async (v) => {
        s.dateFormat = v;
        await this.host.saveSettings();
      })
    );
    containerEl.createEl("p", {
      text: "API tokens are stored in plaintext in this vault's data.json.",
      cls: "setting-item-description"
    });
  }
};

// src/core/segment.ts
function graphemes(line) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    return Array.from(seg.segment(line), (s) => s.segment);
  }
  return Array.from(line);
}

// src/core/compile.ts
function compile(text, device) {
  const lines = text.split("\n");
  const grid = [];
  const issues = [];
  const overWidth = [];
  lines.forEach((line, row) => {
    const codes = [];
    let col = 0;
    for (const seg of graphemes(line)) {
      const emoji = EMOJI_TO_CODE.get(seg);
      if (emoji !== void 0) {
        codes.push(emoji);
        col++;
        continue;
      }
      const code = charToCode(seg);
      if (code !== void 0) {
        codes.push(code);
        col++;
        continue;
      }
      issues.push({ kind: "unsupported", char: seg, row, col });
    }
    if (codes.length > device.cols) {
      overWidth.push({ row, length: codes.length });
    }
    while (codes.length < device.cols) codes.push(BLANK);
    grid.push(codes);
  });
  return { grid, issues, overWidth };
}

// src/core/autofix.ts
function isSupported(seg) {
  return EMOJI_TO_CODE.has(seg) || charToCode(seg) !== void 0;
}
function autofix(text, device) {
  const lines = text.split("\n");
  const fixedRows = [];
  for (const line of lines) {
    if (fixedRows.length >= device.rows) break;
    const kept = [];
    for (const seg of graphemes(line)) {
      if (!isSupported(seg)) continue;
      if (kept.length >= device.cols) break;
      kept.push(seg);
    }
    fixedRows.push(kept.join(""));
  }
  return fixedRows.join("\n");
}

// src/obsidian/region.ts
var EMPTY = { found: false, message: "", startLine: -1, endLine: -1 };
function readMessageRegion(text, marker, maxRows) {
  const lines = text.split("\n");
  const markerTrim = marker.trim();
  let markerIdx = -1;
  for (let i2 = 0; i2 < lines.length; i2++) {
    if (lines[i2].trim() === markerTrim) {
      markerIdx = i2;
      break;
    }
  }
  if (markerIdx === -1) return EMPTY;
  let start = markerIdx + 1;
  while (start < lines.length && lines[start].trim() === "") start++;
  if (start >= lines.length) return { ...EMPTY, found: true };
  const collected = [];
  let i = start;
  for (; i < lines.length && collected.length < maxRows; i++) {
    const line = lines[i];
    if (line.trim() === "") break;
    if (/^#{1,6}\s/.test(line)) break;
    collected.push(line);
  }
  return {
    found: true,
    message: collected.join("\n"),
    startLine: start,
    endLine: start + collected.length - 1
  };
}

// src/obsidian/sendPrep.ts
function prepareSend(text, marker, device, autofixEnabled) {
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

// src/obsidian/historyWriter.ts
var HISTORY_HEADING = "## Vestaboard History";
var HEADER = "| Live (sent) | Exited | Transport | Message |";
var DIVIDER = "| --- | --- | --- | --- |";
var LIVE_MARK = "\u2014 (live)";
function truncateMessage(message, max = 18) {
  const oneLine = message.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max) + "\u2026";
}
function formatRow(row) {
  return `| ${row.liveAt} | ${row.exitedAt} | ${row.transport} | ${truncateMessage(row.message)} |`;
}
function appendHistory(noteText, row) {
  const newRow = formatRow(row);
  const lines = noteText.split("\n");
  const headingIdx = lines.findIndex((l) => l.trim() === HISTORY_HEADING);
  if (headingIdx === -1) {
    const suffix = noteText.endsWith("\n") || noteText === "" ? "" : "\n";
    const block = [HISTORY_HEADING, HEADER, DIVIDER, newRow, ""].join("\n");
    return noteText + suffix + "\n" + block + "\n";
  }
  let dividerIdx = -1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("| ---")) {
      dividerIdx = i;
      break;
    }
    if (lines[i].startsWith("#") && i !== headingIdx) break;
  }
  if (dividerIdx === -1) {
    lines.splice(headingIdx + 1, 0, HEADER, DIVIDER, newRow);
    return lines.join("\n");
  }
  const firstDataIdx = dividerIdx + 1;
  if (firstDataIdx < lines.length && lines[firstDataIdx].includes(LIVE_MARK)) {
    lines[firstDataIdx] = lines[firstDataIdx].replace(LIVE_MARK, row.liveAt);
  }
  lines.splice(firstDataIdx, 0, newRow);
  return lines.join("\n");
}

// src/obsidian/formatDate.ts
function formatDate(d, fmt) {
  const pad = (n) => String(n).padStart(2, "0");
  return fmt.replace("YYYY", String(d.getFullYear())).replace("MM", pad(d.getMonth() + 1)).replace("DD", pad(d.getDate())).replace("HH", pad(d.getHours())).replace("mm", pad(d.getMinutes()));
}

// src/obsidian/ConfirmModal.ts
var import_obsidian2 = require("obsidian");

// src/obsidian/tileGrid.ts
function renderTileGrid(parent, model, device) {
  const grid = parent.ownerDocument.createElement("div");
  grid.className = "vb-grid";
  grid.style.setProperty("--vb-cols", String(device.cols));
  for (const row of model) {
    for (const t of row) {
      const tile2 = parent.ownerDocument.createElement("div");
      tile2.className = "vb-tile";
      if (t.colorName) tile2.setAttribute("data-color", t.colorName);
      tile2.textContent = t.glyph;
      grid.appendChild(tile2);
    }
  }
  parent.appendChild(grid);
  return grid;
}

// src/obsidian/ConfirmModal.ts
var ConfirmModal = class extends import_obsidian2.Modal {
  constructor(app, model, device, which, resolve) {
    super(app);
    this.model = model;
    this.device = device;
    this.which = which;
    this.resolve = resolve;
    this.settled = false;
  }
  // Resolve exactly once. Guards against both double-resolve (button then
  // onClose) and never-resolve (dismiss via Escape / click-outside, which
  // fires onClose without any button click) — the latter would otherwise
  // hang the awaiting send flow forever.
  settle(ok) {
    if (this.settled) return;
    this.settled = true;
    this.resolve(ok);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Send to Vestaboard" });
    renderTileGrid(contentEl, this.model, this.device);
    contentEl.createEl("p", { text: `Transport: ${this.which}` });
    new import_obsidian2.Setting(contentEl).addButton(
      (b) => b.setButtonText("Send").setCta().onClick(() => {
        this.settle(true);
        this.close();
      })
    ).addButton(
      (b) => b.setButtonText("Cancel").onClick(() => {
        this.settle(false);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
    this.settle(false);
  }
};

// src/obsidian/PreviewView.ts
var import_obsidian3 = require("obsidian");
var VIEW_TYPE_VESTABOARD = "vestaboard-preview";
var PreviewView = class extends import_obsidian3.ItemView {
  constructor(leaf, settings, onSend) {
    super(leaf);
    this.settings = settings;
    this.onSend = onSend;
  }
  getViewType() {
    return VIEW_TYPE_VESTABOARD;
  }
  getDisplayText() {
    return "Vestaboard preview";
  }
  getIcon() {
    return "send";
  }
  async onOpen() {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.refresh())
    );
    this.registerEvent(this.app.workspace.on("editor-change", () => this.refresh()));
    this.refresh();
  }
  refresh() {
    var _a;
    const root = this.contentEl;
    root.empty();
    const device = deviceFor(this.settings.device);
    const view = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
    const text = (_a = view == null ? void 0 : view.editor.getValue()) != null ? _a : "";
    const region = readMessageRegion(text, this.settings.marker, device.rows);
    if (!region.found) {
      root.createEl("p", { text: `No "${this.settings.marker}" section in this note.` });
      return;
    }
    const result = compile(region.message, device);
    const errors = validate(result, device);
    renderTileGrid(root, render(result.grid, device), device);
    const status = root.createEl("p");
    status.textContent = errors.length ? "Invalid: " + errors.map(describeError).join("; ") : "Valid \u2713";
    const btn = root.createEl("button", { text: "Send to Vestaboard" });
    btn.disabled = errors.length > 0 && !this.settings.autofixDefault;
    btn.onclick = () => this.onSend();
  }
  async onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/poller.ts
function gridsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}
var Poller = class {
  constructor(opts) {
    this.opts = opts;
    this.timer = null;
  }
  start() {
    this.stop();
    this.timer = setInterval(() => void this.tick(), this.opts.intervalMs);
  }
  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  async tick() {
    const live = this.opts.getLiveGrid();
    if (!live) return;
    let state;
    try {
      state = await this.opts.readState();
    } catch (e) {
      return;
    }
    if (!gridsEqual(state, live)) {
      this.opts.onExit();
    }
  }
};

// src/main.ts
var requestAdapter = async (opts) => {
  const res = await (0, import_obsidian4.requestUrl)({
    url: opts.url,
    method: opts.method,
    headers: opts.headers,
    body: opts.body,
    throw: false
  });
  let json;
  try {
    json = res.json;
  } catch (e) {
    json = void 0;
  }
  return { status: res.status, json, text: res.text };
};
var VestaboardianPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.poller = null;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VestaboardianSettingTab(this.app, this));
    this.addCommand({
      id: "vestaboardian-send",
      name: "Send message from this note",
      callback: () => this.sendFromActiveNote(this.settings.defaultTransport)
    });
    this.addCommand({
      id: "vestaboardian-send-local",
      name: "Send message from this note via Local",
      callback: () => this.sendFromActiveNote("local")
    });
    this.addCommand({
      id: "vestaboardian-send-cloud",
      name: "Send message from this note via Cloud",
      callback: () => this.sendFromActiveNote("cloud")
    });
    this.addRibbonIcon(
      "send",
      "Send to Vestaboard",
      () => this.sendFromActiveNote(this.settings.defaultTransport)
    );
    this.registerView(
      VIEW_TYPE_VESTABOARD,
      (leaf) => new PreviewView(
        leaf,
        this.settings,
        () => this.sendFromActiveNote(this.settings.defaultTransport)
      )
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
      }
    });
    this.register(() => {
      var _a;
      return (_a = this.poller) == null ? void 0 : _a.stop();
    });
    this.restartPolling();
  }
  restartPolling() {
    var _a;
    (_a = this.poller) == null ? void 0 : _a.stop();
    this.poller = null;
    if (!this.settings.pollingEnabled) return;
    const intervalMs = floorPollInterval(this.settings.pollingIntervalSec) * 1e3;
    this.poller = new Poller({
      intervalMs,
      readState: () => {
        var _a2, _b;
        return this.transportFor((_b = (_a2 = this.settings.liveState) == null ? void 0 : _a2.transport) != null ? _b : this.settings.defaultTransport).readState();
      },
      getLiveGrid: () => {
        var _a2, _b;
        return (_b = (_a2 = this.settings.liveState) == null ? void 0 : _a2.grid) != null ? _b : null;
      },
      onExit: async () => {
        const live = this.settings.liveState;
        if (!live) return;
        this.settings.liveState = null;
        await this.saveSettings();
      }
    });
    this.poller.start();
  }
  transportFor(which) {
    if (which === "local") {
      return new LocalTransport({
        host: this.settings.localHost,
        apiKey: this.settings.localKey,
        request: requestAdapter
      });
    }
    return new CloudTransport({ apiKey: this.settings.cloudKey, request: requestAdapter });
  }
  async sendFromActiveNote(which) {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (!view) {
      new import_obsidian4.Notice("Vestaboardian: open a note first.");
      return;
    }
    if (!view.file) return;
    const device = deviceFor(this.settings.device);
    const text = view.editor.getValue();
    const prep = prepareSend(text, this.settings.marker, device, this.settings.autofixDefault);
    if (!prep.found) {
      new import_obsidian4.Notice(`Vestaboardian: no "${this.settings.marker}" section found.`);
      return;
    }
    if (prep.errors.length > 0) {
      new import_obsidian4.Notice("Vestaboard message invalid:\n" + prep.errors.map(describeError).join("\n"));
      return;
    }
    const model = render(prep.grid, device);
    const confirmed = await new Promise((resolve) => {
      new ConfirmModal(this.app, model, device, which, resolve).open();
    });
    if (!confirmed) return;
    try {
      await this.transportFor(which).send(prep.grid);
    } catch (e) {
      new import_obsidian4.Notice("Vestaboard send failed: " + e.message);
      return;
    }
    const now = formatDate(/* @__PURE__ */ new Date(), this.settings.dateFormat);
    const updated = appendHistory(text, {
      liveAt: now,
      exitedAt: "\u2014 (live)",
      transport: which,
      message: prep.message
    });
    view.editor.setValue(updated);
    this.settings.liveState = {
      grid: prep.grid,
      transport: which,
      message: prep.message,
      liveAt: now
    };
    await this.saveSettings();
    this.restartPolling();
    new import_obsidian4.Notice("Sent to Vestaboard.");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
