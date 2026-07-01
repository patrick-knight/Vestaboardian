import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, MIN_POLL_SEC, floorPollInterval } from "../../src/obsidian/settings";

describe("settings", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_SETTINGS.device).toBe("flagship");
    expect(DEFAULT_SETTINGS.defaultTransport).toBe("cloud");
    expect(DEFAULT_SETTINGS.marker).toBe("## Vestaboard");
    expect(DEFAULT_SETTINGS.liveState).toBeNull();
  });

  it("floors the poll interval to the minimum", () => {
    expect(floorPollInterval(5)).toBe(MIN_POLL_SEC);
    expect(floorPollInterval(30)).toBe(30);
  });
});
