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
      body: JSON.stringify(grid),
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
    if (!isObject(res.json) || !isObject(res.json.currentMessage)) return [];
    const layout = res.json.currentMessage.layout;
    if (typeof layout !== "string" || layout.length === 0) return [];
    try {
      return JSON.parse(layout) as number[][];
    } catch {
      throw new Error("Cloud API read failed: invalid currentMessage.layout JSON");
    }
  }
}
