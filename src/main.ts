import { Notice, Plugin, requestUrl, MarkdownView } from "obsidian";
import { deviceFor } from "./core/device";
import { describeError } from "./core/validate";
import { render } from "./core/render";
import type { RequestFn, Transport } from "./transport/Transport";
import { LocalTransport } from "./transport/localTransport";
import { CloudTransport } from "./transport/cloudTransport";
import {
  DEFAULT_SETTINGS,
  VestaboardianSettingTab,
  type VestaboardianSettings,
} from "./obsidian/settings";
import { prepareSend } from "./obsidian/sendPrep";
import { appendHistory } from "./obsidian/historyWriter";
import { computeMinimalEdit } from "./obsidian/editorDiff";
import { formatDate } from "./obsidian/formatDate";
import { ConfirmModal } from "./obsidian/ConfirmModal";
import { VIEW_TYPE_VESTABOARD, PreviewView } from "./obsidian/PreviewView";
import { Poller } from "./obsidian/poller";
import { floorPollInterval } from "./obsidian/settings";

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
  private poller: Poller | null = null;
  private lastMarkdownView: MarkdownView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new VestaboardianSettingTab(this.app, this));

    // Remember the most recent markdown view: focusing the preview sidebar
    // (e.g. clicking its Send button) makes THAT leaf active, so send/preview
    // must fall back to the note the user was just working in.
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const v = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (v) this.lastMarkdownView = v;
      }),
    );

    this.addCommand({
      id: "send",
      name: "Send message from this note",
      callback: () => this.sendFromActiveNote(this.settings.defaultTransport),
    });
    this.addCommand({
      id: "send-local",
      name: "Send message from this note via Local",
      callback: () => this.sendFromActiveNote("local"),
    });
    this.addCommand({
      id: "send-cloud",
      name: "Send message from this note via Cloud",
      callback: () => this.sendFromActiveNote("cloud"),
    });

    this.addRibbonIcon("send", "Send to Vestaboard", () =>
      this.sendFromActiveNote(this.settings.defaultTransport),
    );

    this.registerView(
      VIEW_TYPE_VESTABOARD,
      (leaf) =>
        new PreviewView(
          leaf,
          this.settings,
          () => this.targetMarkdownView(),
          () => {
            void this.sendFromActiveNote(this.settings.defaultTransport);
          },
        ),
    );

    this.addCommand({
      id: "open-preview",
      name: "Open Vestaboard preview",
      callback: async () => {
        // Reuse an existing preview leaf so repeated invocations reveal it
        // instead of stacking duplicate panes.
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_VESTABOARD)[0];
        const leaf = existing ?? this.app.workspace.getRightLeaf(false);
        if (!leaf) return;
        if (!existing) {
          await leaf.setViewState({ type: VIEW_TYPE_VESTABOARD, active: true });
        }
        await this.app.workspace.revealLeaf(leaf);
      },
    });

    this.register(() => this.poller?.stop());
    this.restartPolling();
  }

  restartPolling(): void {
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
      onExit: () => {
        if (!this.settings.liveState) return;
        // Note-targeted exit stamping is out of scope for polling (note identity
        // is not tracked across restarts); the primary exit stamp is
        // infer-on-next-post. Clear live state so we do not repeatedly fire.
        this.settings.liveState = null;
        void this.saveSettings();
      },
    });
    this.poller.start();
  }

  // The active markdown view, or the last one seen if a non-markdown leaf
  // (like the preview sidebar) currently has focus. The cached view is only
  // trusted while its leaf is still attached to the workspace.
  targetMarkdownView(): MarkdownView | null {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) {
      this.lastMarkdownView = active;
      return active;
    }
    const last = this.lastMarkdownView;
    if (last && this.app.workspace.getLeavesOfType("markdown").some((l) => l.view === last)) {
      return last;
    }
    return null;
  }

  // Re-render any open preview panes; called by the settings tab so device,
  // marker, and auto-fix changes take effect without waiting for a keystroke.
  refreshPreviews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_VESTABOARD)) {
      if (leaf.view instanceof PreviewView) leaf.view.refresh();
    }
  }

  // Exchange a Local API enablement token for the permanent key and store it.
  async enableLocalApi(token: string): Promise<void> {
    const key = await LocalTransport.enable(this.settings.localHost, token, requestAdapter);
    this.settings.localKey = key;
    await this.saveSettings();
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
    const view = this.targetMarkdownView();
    if (!view) {
      new Notice("Vestaboardian: open a note first.");
      return;
    }
    if (!view.file) return;
    const device = deviceFor(this.settings.device);

    // Read the live editor buffer (not disk) so the send matches what the user
    // sees — including the sidebar preview, which also reads the editor — and so
    // writing history back through the editor cannot clobber unsaved edits.
    const text = view.editor.getValue();
    const prep = prepareSend(text, this.settings.marker, device, this.settings.autofixDefault);
    if (!prep.found) {
      new Notice(`Vestaboardian: no "${this.settings.marker}" section found.`);
      return;
    }
    if (prep.errors.length > 0) {
      new Notice("Vestaboard message invalid:\n" + prep.errors.map(describeError).join("\n"));
      return;
    }

    const model = render(prep.grid, device);
    const confirmed = await new Promise<boolean>((resolve) => {
      new ConfirmModal(this.app, model, device, which, resolve).open();
    });
    if (!confirmed) return;

    try {
      await this.transportFor(which).send(prep.grid);
    } catch (e) {
      new Notice("Vestaboard send failed: " + (e as Error).message);
      return;
    }

    // Record the message that was actually sent (post-autofix), not the raw
    // note text, so history and the polled comparison reflect what the board got.
    // Re-read the buffer — the user may have typed while the confirm modal or
    // network round-trip was pending — and apply the history change as a
    // targeted replaceRange so those edits and the cursor survive.
    const now = formatDate(new Date(), this.settings.dateFormat);
    const fresh = view.editor.getValue();
    const updated = appendHistory(fresh, {
      liveAt: now,
      exitedAt: "— (live)",
      transport: which,
      message: prep.message,
    });
    const edit = computeMinimalEdit(fresh, updated);
    if (edit) view.editor.replaceRange(edit.text, edit.from, edit.to);

    this.settings.liveState = {
      grid: prep.grid,
      transport: which,
      message: prep.message,
      liveAt: now,
    };
    await this.saveSettings();
    this.restartPolling();

    new Notice("Sent to Vestaboard.");
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<VestaboardianSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
