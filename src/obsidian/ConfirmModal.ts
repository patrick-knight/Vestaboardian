import { Modal, Setting, type App } from "obsidian";
import type { Device } from "../core/device";
import type { RenderModel } from "../core/render";
import { renderTileGrid } from "./tileGrid";

export class ConfirmModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private model: RenderModel,
    private device: Device,
    private which: "local" | "cloud",
    private resolve: (ok: boolean) => void,
  ) {
    super(app);
  }

  // Resolve exactly once. Guards against both double-resolve (button then
  // onClose) and never-resolve (dismiss via Escape / click-outside, which
  // fires onClose without any button click) — the latter would otherwise
  // hang the awaiting send flow forever.
  private settle(ok: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(ok);
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
            this.settle(true);
            this.close();
          }),
      )
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          this.settle(false);
          this.close();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
    this.settle(false); // dismissed without a choice → treat as cancel
  }
}
