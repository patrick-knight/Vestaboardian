export interface Transport {
  send(grid: number[][]): Promise<void>;
  readState(): Promise<number[][]>;
}

export type RequestFn = (opts: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; json: unknown; text: string }>;
