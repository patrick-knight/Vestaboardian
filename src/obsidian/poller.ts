export function gridsEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

interface PollerOpts {
  intervalMs: number;
  readState: () => Promise<number[][]>;
  getLiveGrid: () => number[][] | null;
  onExit: () => void;
}

export class Poller {
  private timer: number | null = null;

  constructor(private opts: PollerOpts) {}

  start(): void {
    this.stop();
    // window-scoped timers keep the plugin compatible with popout windows.
    this.timer = window.setInterval(() => void this.tick(), this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const live = this.opts.getLiveGrid();
    if (!live) return;
    let state: number[][];
    try {
      state = await this.opts.readState();
    } catch {
      return; // transient network errors: skip this tick
    }
    if (!gridsEqual(state, live)) {
      this.opts.onExit();
    }
  }
}
