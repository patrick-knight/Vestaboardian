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
import { VIEW_TYPE_VESTABOARD, PreviewView } from "./obsidian/PreviewView";

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

    const text = await this.app.vault.read(file);
    const region = readMessageRegion(text, this.settings.marker, device.rows);
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
