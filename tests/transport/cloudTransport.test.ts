import { describe, it, expect, vi } from "vitest";
import { CloudTransport } from "../../src/transport/cloudTransport";

describe("CloudTransport", () => {
  it("POSTs the grid with the read-write key header", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: {}, text: "" });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    await t.send([[1, 2]]);
    expect(request).toHaveBeenCalledWith({
      url: "https://rw.vestaboard.com/",
      method: "POST",
      headers: { "X-Vestaboard-Read-Write-Key": "RWKEY", "Content-Type": "application/json" },
      body: JSON.stringify([[1, 2]]),
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

  it("readState returns [] for non-object/empty payloads", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: undefined, text: "" });
    const t = new CloudTransport({ apiKey: "RWKEY", request });
    expect(await t.readState()).toEqual([]);
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
});
