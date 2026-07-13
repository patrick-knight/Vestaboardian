import type { Transport, RequestFn } from "./Transport";

interface CloudOpts {
  apiKey: string;
  request: RequestFn;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const BASE = "https://rw.vestaboard.com/";

export class CloudTransport implements Transport {
  constructor(private opts: CloudOpts) {}

  async send(grid: number[][]): Promise<void> {
    const res = await this.opts.request({
      url: BASE,
      method: "POST",
      headers: {
        "X-Vestaboard-Read-Write-Key": this.opts.apiKey,
        "Content-Type": "application/json",
      },
      // Must be the {characters: ...} wrapper: the live API accepts a raw
      // [[...]] body with 2xx but stores it as an EMPTY message (layout "[]"),
      // blanking the board while still logging a history entry.
      body: JSON.stringify({ characters: grid }),
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Cloud API send failed: ${res.status} ${res.text}`);
    }
  }

  async readState(): Promise<number[][]> {
    const res = await this.opts.request({
      url: BASE,
      method: "GET",
      headers: { "X-Vestaboard-Read-Write-Key": this.opts.apiKey },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Cloud API read failed: ${res.status} ${res.text}`);
    }
    // A null currentMessage is a real "nothing on the board" answer and maps
    // to []. Any other unrecognized shape must THROW, not return []: the
    // poller treats a thrown error as a skipped tick, but a returned []
    // compares unequal to the live grid and would permanently clear liveState
    // on a transient glitch.
    if (isObject(res.json) && res.json.currentMessage === null) return [];
    if (!isObject(res.json) || !isObject(res.json.currentMessage)) {
      throw new Error("Cloud API read failed: unrecognized response shape");
    }
    const layout = res.json.currentMessage.layout;
    if (typeof layout !== "string" || layout.length === 0) {
      throw new Error("Cloud API read failed: unrecognized response shape");
    }
    try {
      return JSON.parse(layout) as number[][];
    } catch {
      throw new Error("Cloud API read failed: invalid currentMessage.layout JSON");
    }
  }
}
