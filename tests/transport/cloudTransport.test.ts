import { describe, it, expect, vi } from "vitest";
import { CloudTransport } from "../../src/transport/cloudTransport";

describe("CloudTransport", () => {
  it("POSTs the grid wrapped in a characters object with the read-write key header", async () => {
    // The raw [[...]] body form is described in Vestaboard's docs but the live
    // rw.vestaboard.com API stores it as an EMPTY message (layout "[]"), so the
    // board flips to blank while history shows an entry. The {characters: ...}
    // wrapper is the shape all official examples use and must be preserved.
    const request = vi.fn().mockResolvedValue({ status: 200, json: {}, text: "" });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    await t.send([[1, 2]]);
    expect(request).toHaveBeenCalledWith({
      url: "https://rw.vestaboard.com/",
      method: "POST",
      headers: { "X-Vestaboard-Read-Write-Key": "RWKEY", "Content-Type": "application/json" },
      body: JSON.stringify({ characters: [[1, 2]] }),
    });
  });

  it("readState parses the layout JSON string", async () => {
    const board = [[1, 2]];
    const request = vi.fn().mockResolvedValue({
      status: 200,
      json: { currentMessage: { layout: JSON.stringify(board) } },
      text: "",
    });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    expect(await t.readState()).toEqual(board);
  });

  it("readState returns [] for an explicit null currentMessage (nothing on the board)", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      json: { currentMessage: null },
      text: "",
    });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    expect(await t.readState()).toEqual([]);
  });

  it("readState throws on an unrecognized response shape (poller skips the tick)", async () => {
    // Must throw rather than return []: the poller skips ticks on errors, but
    // a returned [] compares unequal to the live grid and would permanently
    // clear liveState on a transient glitch.
    const t = (json: unknown) =>
      new CloudTransport({
        apiKey: "RWKEY",
        request: vi.fn().mockResolvedValue({ status: 200, json, text: "" }),
      });
    await expect(t(undefined).readState()).rejects.toThrow(/unrecognized response shape/);
    await expect(t({}).readState()).rejects.toThrow(/unrecognized response shape/);
    await expect(t({ currentMessage: {} }).readState()).rejects.toThrow(
      /unrecognized response shape/,
    );
  });

  it("readState throws a clear error for invalid layout JSON", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      json: { currentMessage: { layout: "not-json" } },
      text: "",
    });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    await expect(t.readState()).rejects.toThrow(/invalid currentMessage\.layout JSON/);
  });

  it("throws on non-2xx", async () => {
    const request = vi.fn().mockResolvedValue({ status: 403, json: {}, text: "denied" });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    await expect(t.send([[1]])).rejects.toThrow(/403/);
  });

  it("surfaces the API's human-readable error message (e.g. quiet hours)", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 423,
      json: { status: "error", message: "It is quiet hours on this Vestaboard.", type: "QuietHours" },
      text: '{"status":"error","message":"It is quiet hours on this Vestaboard.","type":"QuietHours"}',
    });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    await expect(t.send([[1]])).rejects.toThrow(/quiet hours on this Vestaboard/);
  });
});
