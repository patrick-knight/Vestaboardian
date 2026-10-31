// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gridsEqual, Poller } from "../../src/obsidian/poller";

describe("gridsEqual", () => {
  it("true for identical grids", () => {
    expect(gridsEqual([[1, 2]], [[1, 2]])).toBe(true);
  });
  it("false for differing grids", () => {
    expect(gridsEqual([[1, 2]], [[1, 3]])).toBe(false);
    expect(gridsEqual([[1]], [[1, 2]])).toBe(false);
  });
});

describe("Poller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls onExit when the board no longer matches the live grid", async () => {
    let live: number[][] | null = [[1, 2]];
    const onExit = vi.fn();
    const p = new Poller({
      intervalMs: 1000,
      readState: async () => [[9, 9]], // board changed
      getLiveGrid: () => live,
      onExit: () => {
        onExit();
        live = null;
      },
    });
    p.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onExit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onExit).toHaveBeenCalledTimes(1); // not called again after cleared
    p.stop();
  });

  it("does not call onExit while the board still matches", async () => {
    const onExit = vi.fn();
    const p = new Poller({
      intervalMs: 1000,
      readState: async () => [[1, 2]],
      getLiveGrid: () => [[1, 2]],
      onExit,
    });
    p.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(onExit).not.toHaveBeenCalled();
    p.stop();
  });

  it("reports persistent failure once consecutive errors cross the threshold", async () => {
    const onPersistentError = vi.fn();
    const p = new Poller({
      intervalMs: 1000,
      readState: async () => {
        throw new Error("boom");
      },
      getLiveGrid: () => [[1, 2]],
      onExit: vi.fn(),
      onPersistentError,
    });
    p.start();
    await vi.advanceTimersByTimeAsync(2000); // 2 failures: below threshold
    expect(onPersistentError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000); // 3rd failure: crosses threshold
    expect(onPersistentError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000); // stays silent while streak continues
    expect(onPersistentError).toHaveBeenCalledTimes(1);
    p.stop();
  });

  it("resets the failure streak after a successful read", async () => {
    const onPersistentError = vi.fn();
    let fail = true;
    const p = new Poller({
      intervalMs: 1000,
      readState: async () => {
        if (fail) throw new Error("boom");
        return [[1, 2]];
      },
      getLiveGrid: () => [[1, 2]],
      onExit: vi.fn(),
      onPersistentError,
    });
    p.start();
    await vi.advanceTimersByTimeAsync(2000); // 2 failures
    fail = false;
    await vi.advanceTimersByTimeAsync(1000); // success resets the streak
    fail = true;
    await vi.advanceTimersByTimeAsync(2000); // only 2 failures again: below threshold
    expect(onPersistentError).not.toHaveBeenCalled();
    p.stop();
  });
});
