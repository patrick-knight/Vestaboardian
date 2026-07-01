import type { Transport, RequestFn } from "./Transport";

interface LocalOpts {
  host: string;
  apiKey: string;
  request: RequestFn;
}

export class LocalTransport implements Transport {
  constructor(private opts: LocalOpts) {}

  private url(): string {
    return `http://${this.opts.host}:7000/local-api/message`;
  }

  async send(grid: number[][]): Promise<void> {
    const res = await this.opts.request({
      url: this.url(),
      method: "POST",
      headers: {
        "X-Vestaboard-Local-Api-Key": this.opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(grid),
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Local API send failed: ${res.status} ${res.text}`);
    }
  }

  async readState(): Promise<number[][]> {
    const res = await this.opts.request({
      url: this.url(),
      method: "GET",
      headers: { "X-Vestaboard-Local-Api-Key": this.opts.apiKey },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Local API read failed: ${res.status} ${res.text}`);
    }
    // The Local API returns the grid directly as a 2D array; tolerate a
    // {message: [...]} wrapper as well in case firmware versions differ.
    if (Array.isArray(res.json)) return res.json as number[][];
    const body = res.json as { message?: number[][] };
    return body.message ?? [];
  }

  static async enable(
    host: string,
    enablementToken: string,
    request: RequestFn,
  ): Promise<string> {
    const res = await request({
      url: `http://${host}:7000/local-api/enablement`,
      method: "POST",
      headers: { "X-Vestaboard-Local-Api-Enablement-Token": enablementToken },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Enablement failed: ${res.status} ${res.text}`);
    }
    return (res.json as { apiKey: string }).apiKey;
  }
}
