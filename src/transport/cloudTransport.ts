import type { Transport, RequestFn } from "./Transport";

interface CloudOpts {
  apiKey: string;
  request: RequestFn;
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
    const body = res.json as { currentMessage?: { layout?: string } };
    const layout = body.currentMessage?.layout;
    return layout ? (JSON.parse(layout) as number[][]) : [];
  }
}
