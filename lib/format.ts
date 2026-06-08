/**
 * format.ts — small display helpers shared across components.
 */

/** Format a gwei value with fixed decimals. */
export function fmtGwei(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format an integer count / nonce. */
export function fmtInt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Format a 0..1 probability as a whole-number percentage. */
export function fmtPct(p: number, decimals = 0): string {
  return `${(p * 100).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Format a wall-clock time from a ms timestamp. */
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

/**
 * Estimate the worst-case fee in ETH for a transaction given a maxFeePerGas
 * (gwei) and a gas limit. 1 gwei = 1e-9 ETH.
 */
export function feeInEth(maxFeeGwei: number, gasLimit: number): number {
  return (maxFeeGwei * gasLimit) / 1e9;
}
