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
