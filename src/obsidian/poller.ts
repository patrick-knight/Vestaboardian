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

// Consecutive read failures before we surface anything to the user: a couple
// of transient network blips should stay silent, but a dead key/host
// shouldn't fail forever with no signal.
const FAILURE_NOTICE_THRESHOLD = 3;

interface PollerOpts {
  intervalMs: number;
  readState: () => Promise<number[][]>;
  getLiveGrid: () => number[][] | null;
  onExit: () => void;
  // Called once, when consecutive readState failures reach the threshold.
  // Fires again if failures resume after a successful read in between.
  onPersistentError?: (err: unknown) => void;
}

export class Poller {
  private timer: number | null = null;
  private consecutiveFailures = 0;
  private notifiedThisFailureStreak = false;

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
    } catch (err) {
      this.consecutiveFailures++;
      if (
        this.consecutiveFailures >= FAILURE_NOTICE_THRESHOLD &&
        !this.notifiedThisFailureStreak
      ) {
        this.notifiedThisFailureStreak = true;
        this.opts.onPersistentError?.(err);
      }
      return; // transient network errors: skip this tick
    }
    this.consecutiveFailures = 0;
    this.notifiedThisFailureStreak = false;
    if (!gridsEqual(state, live)) {
      this.opts.onExit();
    }
  }
}
