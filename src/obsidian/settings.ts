import {
  Notice,
  PluginSettingTab,
  Setting,
  type App,
  type Plugin,
  type TextComponent,
} from "obsidian";
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
  // Re-evaluate the poller against current settings. Called from the polling
  // controls so enabling/disabling/retiming polling takes effect immediately
  // rather than only on the next send or reload.
  restartPolling(): void;
  // Re-render open preview panes so device/marker/auto-fix changes show
  // immediately instead of waiting for the next keystroke or leaf change.
  refreshPreviews(): void;
  // Exchange a Local API enablement token for the permanent key (stored in
  // settings.localKey by the host).
  enableLocalApi(token: string): Promise<void>;
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
            this.host.refreshPreviews();
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
      .addText((t) => {
        t.inputEl.type = "password";
        t.setValue(s.cloudKey).onChange(async (v) => {
          s.cloudKey = v.trim();
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl).setName("Local host").addText((t) =>
      t.setValue(s.localHost).onChange(async (v) => {
        s.localHost = v.trim();
        await this.host.saveSettings();
      }),
    );

    let localKeyInput: TextComponent | null = null;
    new Setting(containerEl).setName("Local API key").addText((t) => {
      localKeyInput = t;
      t.inputEl.type = "password";
      t.setValue(s.localKey).onChange(async (v) => {
        s.localKey = v.trim();
        await this.host.saveSettings();
      });
    });

    let enablementToken = "";
    new Setting(containerEl)
      .setName("Enable Local API")
      .setDesc(
        "Paste the enablement token from vestaboard.com/local-api and press Enable; " +
          "the permanent key is fetched from the board and stored above.",
      )
      .addText((t) => {
        t.setPlaceholder("Enablement token");
        t.inputEl.type = "password";
        t.onChange((v) => {
          enablementToken = v.trim();
        });
      })
      .addButton((b) =>
        b.setButtonText("Enable").onClick(async () => {
          if (!enablementToken) {
            new Notice("Vestaboardian: paste the enablement token first.");
            return;
          }
          try {
            await this.host.enableLocalApi(enablementToken);
            new Notice("Local API enabled — key saved.");
            // Show the stored key in the field above without a full re-render.
            localKeyInput?.setValue(s.localKey);
          } catch (e) {
            new Notice("Local API enablement failed: " + (e as Error).message);
          }
        }),
      );

    new Setting(containerEl)
      .setName("Message marker heading")
      .addText((t) =>
        t.setValue(s.marker).onChange(async (v) => {
          s.marker = v.trim() || "## Vestaboard";
          await this.host.saveSettings();
          this.host.refreshPreviews();
        }),
      );

    new Setting(containerEl)
      .setName("Auto-fix by default")
      .addToggle((t) =>
        t.setValue(s.autofixDefault).onChange(async (v) => {
          s.autofixDefault = v;
          await this.host.saveSettings();
          this.host.refreshPreviews();
        }),
      );

    new Setting(containerEl)
      .setName("Poll the board for exit times")
      .addToggle((t) =>
        t.setValue(s.pollingEnabled).onChange(async (v) => {
          s.pollingEnabled = v;
          await this.host.saveSettings();
          this.host.restartPolling();
        }),
      );

    new Setting(containerEl)
      .setName(`Poll interval (seconds, min ${MIN_POLL_SEC})`)
      .addText((t) =>
        t.setValue(String(s.pollingIntervalSec)).onChange(async (v) => {
          s.pollingIntervalSec = floorPollInterval(Number(v) || MIN_POLL_SEC);
          await this.host.saveSettings();
          this.host.restartPolling();
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
