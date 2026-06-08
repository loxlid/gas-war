/**
 * gas.ts
 * -----------------------------------------------------------------------------
 * The core priority-fee bidding math. This is intentionally framework-agnostic
 * and pure (no React, no network) so it can be unit-tested and, in principle,
 * reused inside a real bot that signs and broadcasts EIP-1559 transactions.
 *
 * Background — EIP-1559 fee market:
 *   Every block has a protocol-set `baseFeePerGas` that is burned. To get
 *   included, a transaction offers:
 *     - maxPriorityFeePerGas ("the tip") — the bribe paid to the validator.
 *     - maxFeePerGas — the absolute ceiling you'll pay per gas, which must
 *       cover baseFee + tip. The wallet refunds the difference between
 *       maxFeePerGas and (baseFee + tip).
 *   In a race (NFT mint, liquidation, arb), whoever offers the higher effective
 *   tip generally lands earlier in the block. This module turns "how badly do I
 *   want in" into concrete gwei numbers, and models how to escalate that bid
 *   block-over-block until the transaction is included.
 *
 * All gas values are expressed in gwei unless stated otherwise.
 */

/** How aggressively the user wants inclusion, 0 (cheap) .. 1 (win at all costs). */
export type Urgency = number;

export interface BidRecommendation {
  /** Recommended maxPriorityFeePerGas (the tip), gwei. */
  priorityFee: number;
  /** Recommended maxFeePerGas (the ceiling), gwei. */
  maxFee: number;
  /** Modelled probability (0..1) this tip lands in the next block. */
  inclusionProbability: number;
  /** The base fee this recommendation was computed against, gwei. */
  baseFee: number;
}

export interface EscalationRung {
  /** Block offset from now (0 = next block). */
  block: number;
  /** Tip offered on this attempt, gwei. */
  priorityFee: number;
  /** maxFeePerGas offered on this attempt, gwei. */
  maxFee: number;
  /** Modelled probability this rung lands, given the projected base fee. */
  inclusionProbability: number;
}

/** Clamp a number into [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Round to 4 decimal places to keep gwei display sane. */
function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Return the value at a given percentile (0..100) of a numeric sample.
 * Uses linear interpolation between closest ranks. Empty input returns 0.
 *
 * Mempool tip distributions are the raw material for fee estimation: to beat
 * the field you bid somewhere in the upper percentiles of recently-paid tips.
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (clamp(p, 0, 100) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/**
 * Recommend a priority fee (tip) in gwei.
 *
 * Strategy: pick a target percentile of recently-paid tips that scales with
 * urgency — a relaxed bid sits near the median (~50th), a maximum-urgency bid
 * sits in the tail (~99th) and adds a small premium on top to jump the queue.
 * A floor keeps the tip above dust so it is never ignored by builders.
 *
 * @param baseFee     Current base fee per gas, gwei (used only for the floor).
 * @param urgency     0..1 — how badly inclusion is wanted.
 * @param recentTips  Recently-paid priority fees from the mempool, gwei.
 * @returns Recommended maxPriorityFeePerGas in gwei.
 */
export function recommendPriorityFee(
  baseFee: number,
  urgency: Urgency,
  recentTips: number[],
): number {
  const u = clamp(urgency, 0, 1);
  // Map urgency 0..1 onto the 50th..99th percentile of observed tips.
  const targetPct = 50 + u * 49;
  const base = percentile(recentTips, targetPct);
  // High urgency adds a premium (up to +40%) to leapfrog same-percentile bids.
  const premium = 1 + u * 0.4;
  // Never tip less than 1 gwei, nor less than 5% of the base fee.
  const floor = Math.max(1, baseFee * 0.05);
  return round(Math.max(floor, base * premium));
}

/**
 * Compute maxFeePerGas (the ceiling) in gwei.
 *
 * Must cover base fee + tip, plus a buffer so the transaction survives base-fee
 * spikes over the next few blocks (base fee can rise up to 12.5% per block).
 *
 * @param baseFee     Current base fee per gas, gwei.
 * @param priorityFee The tip you intend to pay, gwei.
 * @param bufferPct   Headroom over base fee, e.g. 25 for +25%. Default 25.
 * @returns Recommended maxFeePerGas in gwei.
 */
export function maxFeePerGas(
  baseFee: number,
  priorityFee: number,
  bufferPct = 25,
): number {
  const buffered = baseFee * (1 + clamp(bufferPct, 0, 500) / 100);
  return round(buffered + priorityFee);
}

/**
 * Estimate the probability (0..1) that a given tip lands in the next block,
 * relative to the distribution of competing tips.
 *
 * Model: a logistic curve centred on the median competing tip, scaled by the
 * spread between the median and the 90th percentile. A tip at the median lands
 * ~50% of the time; a tip well into the tail approaches certainty; a dust tip
 * approaches zero. This is a heuristic for the demo, not a chain guarantee.
 *
 * @param tip            The priority fee you are offering, gwei.
 * @param percentileTips The competing tips sampled from the mempool, gwei.
 * @returns Probability in [0, 1].
 */
export function estimateInclusionProbability(
  tip: number,
  percentileTips: number[],
): number {
  if (percentileTips.length === 0) return tip > 0 ? 0.5 : 0;
  const mid = percentile(percentileTips, 50);
  const high = percentile(percentileTips, 90);
  // Spread sets the steepness; guard against a degenerate (flat) distribution.
  const spread = Math.max(high - mid, mid * 0.1, 0.5);
  const z = (tip - mid) / spread;
  // Logistic squashing into (0, 1).
  const prob = 1 / (1 + Math.exp(-z));
  return clamp(round(prob), 0, 1);
}

export interface EscalationOptions {
  /** Number of attempts / blocks to plan for (>= 1). */
  blocks: number;
  /** Multiplicative bump applied to the tip each block (e.g. 1.25 = +25%). */
  factor: number;
  /**
   * Optional projected base fees per block (gwei). If omitted, the base fee is
   * assumed flat at `baseFee`. Used to size each rung's maxFeePerGas.
   */
  projectedBaseFees?: number[];
  /** Buffer percent for each rung's maxFeePerGas. Default 25. */
  bufferPct?: number;
  /** Competing tip distribution used to score each rung. Optional. */
  competingTips?: number[];
}

/**
 * Build an escalation ladder: a "replacement transaction" bid schedule that
 * bumps the tip every block until the transaction is (hopefully) included.
 *
 * This mirrors how a sniping bot resubmits the SAME nonce with a higher tip:
 * the network requires a meaningful bump (commonly >= ~12.5%) to replace a
 * pending transaction, so `factor` should be at least ~1.125 to be accepted.
 *
 * @param initialTip Starting priority fee for the first attempt, gwei.
 * @param baseFee    Base fee at the first attempt, gwei.
 * @param opts       Escalation parameters.
 * @returns One rung per planned block, with tip / maxFee / inclusion odds.
 */
export function escalationSchedule(
  initialTip: number,
  baseFee: number,
  opts: EscalationOptions,
): EscalationRung[] {
  const blocks = Math.max(1, Math.floor(opts.blocks));
  const factor = Math.max(1, opts.factor);
  const bufferPct = opts.bufferPct ?? 25;
  const rungs: EscalationRung[] = [];

  for (let i = 0; i < blocks; i++) {
    const tip = round(initialTip * Math.pow(factor, i));
    const projectedBase =
      opts.projectedBaseFees && opts.projectedBaseFees[i] !== undefined
        ? opts.projectedBaseFees[i]
        : baseFee;
    const maxFee = maxFeePerGas(projectedBase, tip, bufferPct);
    const inclusionProbability = opts.competingTips
      ? estimateInclusionProbability(tip, opts.competingTips)
      : clamp(round(1 / (1 + Math.exp(-(tip - baseFee) / (baseFee || 1)))), 0, 1);
    rungs.push({ block: i, priorityFee: tip, maxFee, inclusionProbability });
  }

  return rungs;
}

/**
 * Cumulative probability of being included by block N, given each rung's
 * independent per-block inclusion probability. Useful for "what are my odds of
 * landing within K blocks" headline stats.
 *
 * P(included by N) = 1 - Π (1 - p_i)
 */
export function cumulativeInclusion(rungs: EscalationRung[]): number[] {
  const out: number[] = [];
  let missAll = 1;
  for (const rung of rungs) {
    missAll *= 1 - rung.inclusionProbability;
    out.push(clamp(round(1 - missAll), 0, 1));
  }
  return out;
}

/**
 * Produce a full bid recommendation from current conditions.
 * Convenience wrapper combining the functions above.
 */
export function recommendBid(
  baseFee: number,
  urgency: Urgency,
  recentTips: number[],
  bufferPct = 25,
): BidRecommendation {
  const priorityFee = recommendPriorityFee(baseFee, urgency, recentTips);
  const maxFee = maxFeePerGas(baseFee, priorityFee, bufferPct);
  const inclusionProbability = estimateInclusionProbability(
    priorityFee,
    recentTips,
  );
  return { priorityFee, maxFee, inclusionProbability, baseFee };
}
