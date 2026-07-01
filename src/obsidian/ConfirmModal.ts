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
