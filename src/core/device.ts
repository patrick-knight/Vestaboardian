export type DeviceName = "flagship" | "note";

export interface Device {
  name: DeviceName;
  rows: number;
  cols: number;
}

export const FLAGSHIP: Device = { name: "flagship", rows: 6, cols: 22 };
export const NOTE: Device = { name: "note", rows: 3, cols: 15 };

export function deviceFor(name: DeviceName): Device {
  return name === "note" ? NOTE : FLAGSHIP;
}
