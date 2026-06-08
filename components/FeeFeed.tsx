"use client";

import { useMemo } from "react";
import { percentile } from "@/lib/gas";
import { fmtGwei, fmtInt } from "@/lib/format";
import type { GasBlock } from "@/lib/feeFeed";

interface Props {
  block: GasBlock | null;
  /** Recent base-fee samples (oldest -> newest) for the sparkline. */
  baseFeeHistory: number[];
  running: boolean;
}

const W = 720;
const H = 120;

/**
 * Live gas feed: the current base fee, a sparkline of recent base fees, and the
 * percentile breakdown of priority fees ("tips") competing in the latest block.
 * Lightweight SVG — no chart library.
 */
export default function FeeFeed({ block, baseFeeHistory, running }: Props) {
  const tipStats = useMemo(() => {
    if (!block) return null;
    return {
      p10: percentile(block.tips, 10),
      p50: percentile(block.tips, 50),
      p90: percentile(block.tips, 90),
      p99: percentile(block.tips, 99),
    };
  }, [block]);

  const spark = useMemo(() => {
    if (baseFeeHistory.length < 2) return "";
    const lo = Math.min(...baseFeeHistory);
    const hi = Math.max(...baseFeeHistory);
    const span = hi - lo || 1;
    return baseFeeHistory
      .map((v, i) => {
        const x = (i / (baseFeeHistory.length - 1)) * W;
        const y = H - ((v - lo) / span) * (H - 12) - 6;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [baseFeeHistory]);

  return (
    <section className="brutal-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase">Live Gas Feed</h2>
        <span className={`pill ${running ? "bg-mint" : "bg-white"}`}>
          {running ? "● streaming" : "○ paused"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-3 border-ink bg-ink p-3 text-white">
          <div className="text-[10px] font-bold uppercase text-white/70">
            Base Fee
          </div>
          <div className="font-display text-2xl text-flame">
            {block ? fmtGwei(block.baseFeePerGas) : "—"}
          </div>
          <div className="text-[10px] uppercase text-white/50">gwei</div>
        </div>
        <div className="border-2 border-ink bg-cream p-3">
          <div className="text-[10px] font-bold uppercase text-ink/60">
            Median Tip
          </div>
          <div className="font-display text-2xl">
            {tipStats ? fmtGwei(tipStats.p50) : "—"}
          </div>
          <div className="text-[10px] uppercase text-ink/50">p50 · gwei</div>
        </div>
        <div className="border-2 border-ink bg-cream p-3">
          <div className="text-[10px] font-bold uppercase text-ink/60">
            Aggressive Tip
          </div>
          <div className="font-display text-2xl">
            {tipStats ? fmtGwei(tipStats.p90) : "—"}
          </div>
          <div className="text-[10px] uppercase text-ink/50">p90 · gwei</div>
        </div>
        <div className="border-2 border-ink bg-cream p-3">
          <div className="text-[10px] font-bold uppercase text-ink/60">
            Block
          </div>
          <div className="font-display text-2xl">
            {block ? `#${fmtInt(block.blockNumber)}`.slice(-8) : "—"}
          </div>
          <div className="text-[10px] uppercase text-ink/50">height</div>
        </div>
      </div>

      <div className="mt-4 border-3 border-ink bg-cream">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Base fee history"
        >
          {spark && (
            <>
              <polyline
                points={`${spark} ${W},${H} 0,${H}`}
                fill="#ff7a1a22"
                stroke="none"
              />
              <polyline
                points={spark}
                fill="none"
                stroke="#ff7a1a"
                strokeWidth={2}
              />
            </>
          )}
          {!spark && (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              fontSize={12}
              fontFamily="JetBrains Mono, monospace"
              fill="#0a0a0a"
              opacity={0.5}
            >
              waiting for blocks…
            </text>
          )}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase">
        <span className="pill bg-white">base fee track</span>
        {tipStats && (
          <>
            <span className="pill bg-mint">p10 {fmtGwei(tipStats.p10)}</span>
            <span className="pill bg-sunny">p50 {fmtGwei(tipStats.p50)}</span>
            <span className="pill bg-flame text-white">
              p90 {fmtGwei(tipStats.p90)}
            </span>
            <span className="pill bg-bubble">p99 {fmtGwei(tipStats.p99)}</span>
          </>
        )}
      </div>
    </section>
  );
}
