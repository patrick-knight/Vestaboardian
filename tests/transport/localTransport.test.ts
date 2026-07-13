import { describe, it, expect, vi } from "vitest";
import { LocalTransport } from "../../src/transport/localTransport";

function grid(): number[][] {
  return [[1, 2, 3]];
}

describe("LocalTransport", () => {
  it("POSTs the grid with the local api key header", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: {}, text: "" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    await t.send(grid());
    expect(request).toHaveBeenCalledWith({
      url: "http://vestaboard.local:7000/local-api/message",
      method: "POST",
      headers: { "X-Vestaboard-Local-Api-Key": "KEY", "Content-Type": "application/json" },
      body: JSON.stringify(grid()),
    });
  });

  it("readState GETs and returns the raw 2D array the Local API sends", async () => {
    const board = [[1, 2]];
    // Verified against docs.vestaboard.com: the Local API GET returns the grid
    // directly as a 2D array (not wrapped in a `message` key).
    const request = vi.fn().mockResolvedValue({ status: 200, json: board, text: "" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    expect(await t.readState()).toEqual(board);
    expect(request).toHaveBeenCalledWith({
      url: "http://vestaboard.local:7000/local-api/message",
      method: "GET",
      headers: { "X-Vestaboard-Local-Api-Key": "KEY" },
    });
  });

  it("readState also tolerates a {message} wrapper if firmware returns one", async () => {
    const board = [[3, 4]];
    const request = vi.fn().mockResolvedValue({ status: 200, json: { message: board }, text: "" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    expect(await t.readState()).toEqual(board);
  });

  it("readState throws on an unrecognized response shape (poller skips the tick)", async () => {
    // Must throw rather than return []: the poller skips ticks on errors, but
    // a returned [] compares unequal to the live grid and would permanently
    // clear liveState on a transient glitch.
    const request = vi.fn().mockResolvedValue({ status: 200, json: undefined, text: "" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    await expect(t.readState()).rejects.toThrow(/unrecognized response shape/);
  });

  it("throws on non-2xx send", async () => {
    const request = vi.fn().mockResolvedValue({ status: 401, json: {}, text: "nope" });
    const t = new LocalTransport({ host: "vestaboard.local", apiKey: "KEY", request });
    await expect(t.send(grid())).rejects.toThrow(/401/);
  });

  it("enable() posts the enablement token and returns apiKey", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: { apiKey: "NEWKEY" }, text: "" });
    const key = await LocalTransport.enable("vestaboard.local", "ENABLE", request);
    expect(key).toBe("NEWKEY");
    expect(request).toHaveBeenCalledWith({
      url: "http://vestaboard.local:7000/local-api/enablement",
      method: "POST",
      headers: { "X-Vestaboard-Local-Api-Enablement-Token": "ENABLE" },
    });
  });

  it("enable() throws a clear error when apiKey is missing from response", async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, json: {}, text: "" });
    await expect(LocalTransport.enable("vestaboard.local", "ENABLE", request)).rejects.toThrow(
      /did not include apiKey/,
    );
  });
});
