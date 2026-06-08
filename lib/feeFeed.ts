/**
 * feeFeed.ts
 * -----------------------------------------------------------------------------
 * A WebSocket-style live gas-feed simulator. There is no real RPC in this demo,
 * so we fake an eth_feeHistory-like stream with setInterval. The shape of the
 * API (subscribe -> receive blocks -> unsubscribe) deliberately mirrors what a
 * real provider subscription would expose, so swapping in a JSON-RPC backed
 * feed later would be a drop-in change.
 *
 * Each emitted "block" carries:
 *   - baseFeePerGas: a bounded random walk; the protocol moves base fee at most
 *     ~12.5% per block, so steps are capped to stay realistic.
 *   - tips: a sampled distribution of priority fees "paid" in that block, which
 *     the estimator percentiles against.
 */

export interface GasBlock {
  /** Monotonic block number for the simulation. */
  blockNumber: number;
  /** Base fee per gas for this block, gwei. */
  baseFeePerGas: number;
  /** Sampled priority fees (tips) seen in this block, gwei. */
  tips: number[];
  /** Simulation timestamp (ms). */
  timestamp: number;
}

export type BlockHandler = (block: GasBlock) => void;

export interface FeeFeedOptions {
  /** Starting base fee, gwei. */
  startBaseFee?: number;
  /** Soft band the base-fee walk is pulled back toward, gwei. */
  bandLow?: number;
  bandHigh?: number;
  /** Block interval in ms (mainnet ~12s; sped up for the demo). */
  intervalMs?: number;
  /** How many tip samples to synthesize per block. */
  tipSamples?: number;
}

const DEFAULTS = {
  startBaseFee: 24,
  bandLow: 8,
  bandHigh: 120,
  intervalMs: 2000,
  tipSamples: 40,
};

export class FeeFeed {
  private baseFee: number;
  private readonly bandLow: number;
  private readonly bandHigh: number;
  private readonly mid: number;
  private readonly intervalMs: number;
  private readonly tipSamples: number;
  private blockNumber = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private handlers = new Set<BlockHandler>();

  constructor(opts: FeeFeedOptions = {}) {
    this.baseFee = opts.startBaseFee ?? DEFAULTS.startBaseFee;
    this.bandLow = opts.bandLow ?? DEFAULTS.bandLow;
    this.bandHigh = opts.bandHigh ?? DEFAULTS.bandHigh;
    this.mid = (this.bandLow + this.bandHigh) / 2;
    this.intervalMs = opts.intervalMs ?? DEFAULTS.intervalMs;
    this.tipSamples = opts.tipSamples ?? DEFAULTS.tipSamples;
    // Seed a plausible starting block height.
    this.blockNumber = 21_000_000 + Math.floor(Math.random() * 100_000);
  }

  /** Register a block handler. Returns an unsubscribe function. */
  subscribe(handler: BlockHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Begin emitting blocks. Emits an immediate first block. */
  start(): void {
    if (this.timer) return;
    this.emit();
    this.timer = setInterval(() => this.step(), this.intervalMs);
  }

  /** Stop emitting blocks. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  currentBaseFee(): number {
    return this.baseFee;
  }

  private step(): void {
    // Base fee moves at most ~12.5% per block (EIP-1559 cap), with mild
    // mean-reversion toward the band midpoint to keep the demo lively.
    const maxStep = 0.125;
    const shock = (Math.random() - 0.5) * 2 * maxStep;
    const reversion = ((this.mid - this.baseFee) / this.mid) * 0.04;
    let next = this.baseFee * (1 + shock + reversion);

    // Reflect at padded band edges so it never runs away.
    const pad = (this.bandHigh - this.bandLow) * 0.1;
    const min = this.bandLow - pad;
    const max = this.bandHigh + pad;
    if (next < min) next = min + (min - next);
    if (next > max) next = max - (next - max);

    this.baseFee = Math.round(next * 1e4) / 1e4;
    this.blockNumber += 1;
    this.emit();
  }

  /** Synthesize a skewed tip distribution that tracks current congestion. */
  private sampleTips(): number[] {
    // Congestion proxy: how far base fee sits above the band low.
    const congestion =
      (this.baseFee - this.bandLow) / (this.bandHigh - this.bandLow);
    const centre = 1 + congestion * 6; // gwei
    const out: number[] = [];
    for (let i = 0; i < this.tipSamples; i++) {
      // Exponential-ish skew: most tips low, a fat tail of aggressive bids.
      const u = Math.random();
      const skew = -Math.log(1 - u) * centre;
      out.push(Math.round(skew * 1e3) / 1e3);
    }
    return out;
  }

  private emit(): void {
    const block: GasBlock = {
      blockNumber: this.blockNumber,
      baseFeePerGas: this.baseFee,
      tips: this.sampleTips(),
      timestamp: Date.now(),
    };
    this.handlers.forEach((h) => h(block));
  }
}
