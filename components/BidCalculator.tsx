"use client";

import { useMemo } from "react";
import { recommendBid } from "@/lib/gas";
import { fmtGwei, fmtPct, feeInEth } from "@/lib/format";
import type { GasBlock } from "@/lib/feeFeed";

interface Props {
  block: GasBlock | null;
  urgency: number;
  bufferPct: number;
  gasLimit: number;
  onUrgencyChange: (u: number) => void;
  onBufferChange: (b: number) => void;
  onGasLimitChange: (g: number) => void;
  /** Push the current recommendation into the retry simulator as a starting tip. */
  onArm: (priorityFee: number) => void;
}

function urgencyLabel(u: number): string {
  if (u < 0.2) return "Chill";
  if (u < 0.45) return "Patient";
  if (u < 0.7) return "Eager";
  if (u < 0.9) return "Sniping";
  return "Win at all costs";
}

/**
 * Bid calculator: the user dials in urgency (and buffer / gas limit), and the
 * pure `recommendBid` engine turns the live block into a concrete EIP-1559 bid.
 */
export default function BidCalculator({
  block,
  urgency,
  bufferPct,
  gasLimit,
  onUrgencyChange,
  onBufferChange,
  onGasLimitChange,
  onArm,
}: Props) {
  const rec = useMemo(() => {
    if (!block) return null;
    return recommendBid(block.baseFeePerGas, urgency, block.tips, bufferPct);
  }, [block, urgency, bufferPct]);

  const worstCaseEth = rec ? feeInEth(rec.maxFee, gasLimit) : 0;

  return (
    <section className="brutal-card p-5">
      <h2 className="font-display text-xl uppercase">Bid Calculator</h2>
      <p className="mt-1 text-xs font-bold uppercase text-ink/60">
        Urgency → EIP-1559 bid
      </p>

      <label className="mt-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase">Urgency</span>
          <span className="pill bg-sunny">{urgencyLabel(urgency)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={urgency}
          onChange={(e) => onUrgencyChange(parseFloat(e.target.value))}
          className="h-3 w-full accent-flame"
        />
        <div className="flex justify-between text-[10px] uppercase text-ink/50">
          <span>cheap</span>
          <span>{fmtPct(urgency)}</span>
          <span>aggressive</span>
        </div>
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase">Buffer %</span>
          <input
            className="brutal-input w-full"
            type="number"
            step="1"
            min={0}
            value={Number.isFinite(bufferPct) ? bufferPct : ""}
            onChange={(e) => onBufferChange(parseFloat(e.target.value) || 0)}
          />
          <span className="text-[10px] uppercase text-ink/50">
            base-fee headroom
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase">Gas Limit</span>
          <input
            className="brutal-input w-full"
            type="number"
            step="1000"
            min={21000}
            value={Number.isFinite(gasLimit) ? gasLimit : ""}
            onChange={(e) => onGasLimitChange(parseInt(e.target.value, 10) || 0)}
          />
          <span className="text-[10px] uppercase text-ink/50">units / tx</span>
        </label>
      </div>

      <div className="mt-4 border-3 border-ink bg-ink p-4 text-white">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase text-white/60">
              maxPriorityFeePerGas
            </div>
            <div className="font-display text-2xl text-mint">
              {rec ? fmtGwei(rec.priorityFee) : "—"}
            </div>
            <div className="text-[10px] uppercase text-white/40">tip · gwei</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-white/60">
              maxFeePerGas
            </div>
            <div className="font-display text-2xl text-sunny">
              {rec ? fmtGwei(rec.maxFee) : "—"}
            </div>
            <div className="text-[10px] uppercase text-white/40">
              ceiling · gwei
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t-2 border-white/20 pt-3">
          <span className="pill bg-white text-ink">
            next-block odds {rec ? fmtPct(rec.inclusionProbability) : "—"}
          </span>
          <span className="pill bg-white text-ink">
            worst case ~{worstCaseEth.toFixed(5)} ETH
          </span>
        </div>
      </div>

      <button
        className="brutal-btn mt-4 w-full bg-flame text-white"
        disabled={!rec}
        onClick={() => rec && onArm(rec.priorityFee)}
      >
        ⚔ Arm Retry @ {rec ? fmtGwei(rec.priorityFee) : "—"} gwei
      </button>
    </section>
  );
}
