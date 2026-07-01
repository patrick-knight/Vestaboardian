// Minimal stubs so modules importing "obsidian" can be unit-tested.
export class Plugin {}
export class PluginSettingTab {
  constructor(_app: unknown, _plugin: unknown) {}
}
export class Setting {
  constructor(_el: unknown) {}
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addToggle() { return this; }
  addDropdown() { return this; }
  addButton() { return this; }
}
export class Modal {
  constructor(_app: unknown) {}
}
export class ItemView {
  constructor(_leaf: unknown) {}
}
export class Notice {
  constructor(_msg: string) {}
}
export type App = unknown;
