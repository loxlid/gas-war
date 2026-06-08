"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { escalationSchedule, cumulativeInclusion } from "@/lib/gas";
import { fmtGwei, fmtPct } from "@/lib/format";
import type { GasBlock } from "@/lib/feeFeed";

interface Props {
  block: GasBlock | null;
  /** Starting tip, gwei — set by "Arm Retry" in the calculator. */
  armedTip: number;
  bufferPct: number;
}

type Phase = "idle" | "running" | "included" | "exhausted";

interface AttemptResult {
  block: number;
  priorityFee: number;
  maxFee: number;
  prob: number;
  included: boolean;
}

const BLOCK_MS = 900;

/**
 * Adaptive retry simulator: escalates the same nonce's tip block-over-block
 * (per `escalationSchedule`) and rolls a weighted dice each block to decide
 * whether the transaction got included, until it lands or the ladder runs out.
 */
export default function RetrySimulator({ block, armedTip, bufferPct }: Props) {
  const [blocks, setBlocks] = useState(6);
  const [factor, setFactor] = useState(1.25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idxRef = useRef(0);

  const baseFee = block?.baseFeePerGas ?? 20;
  const tips = useMemo(() => block?.tips ?? [], [block]);

  const ladder = useMemo(
    () =>
      escalationSchedule(armedTip, baseFee, {
        blocks,
        factor,
        bufferPct,
        competingTips: tips,
      }),
    [armedTip, baseFee, blocks, factor, bufferPct, tips],
  );

  const cumulative = useMemo(() => cumulativeInclusion(ladder), [ladder]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const run = useCallback(() => {
    stop();
    setAttempts([]);
    setPhase("running");
    idxRef.current = 0;

    timerRef.current = setInterval(() => {
      const i = idxRef.current;
      if (i >= ladder.length) {
        stop();
        setPhase("exhausted");
        return;
      }
      const rung = ladder[i];
      const included = Math.random() < rung.inclusionProbability;
      setAttempts((prev) => [
        ...prev,
        {
          block: rung.block,
          priorityFee: rung.priorityFee,
          maxFee: rung.maxFee,
          prob: rung.inclusionProbability,
          included,
        },
      ]);
      if (included) {
        stop();
        setPhase("included");
        return;
      }
      idxRef.current += 1;
    }, BLOCK_MS);
  }, [ladder, stop]);

  const reset = useCallback(() => {
    stop();
    setAttempts([]);
    setPhase("idle");
    idxRef.current = 0;
  }, [stop]);

  const finalOdds = cumulative.length
    ? cumulative[cumulative.length - 1]
    : 0;

  return (
    <section className="brutal-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase">Retry Simulator</h2>
        <span
          className={`pill ${
            phase === "included"
              ? "bg-mint"
              : phase === "exhausted"
                ? "bg-loss text-white"
                : phase === "running"
                  ? "bg-sunny"
                  : "bg-white"
          }`}
        >
          {phase === "idle"
            ? "○ armed"
            : phase === "running"
              ? "● escalating"
              : phase === "included"
                ? "✓ included"
                : "✗ exhausted"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase">Start Tip</span>
          <div className="brutal-input w-full bg-cream">{fmtGwei(armedTip)}</div>
          <span className="text-[10px] uppercase text-ink/50">gwei</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase">Blocks</span>
          <input
            className="brutal-input w-full"
            type="number"
            min={1}
            max={20}
            value={blocks}
            disabled={phase === "running"}
            onChange={(e) =>
              setBlocks(Math.max(1, parseInt(e.target.value, 10) || 1))
            }
          />
          <span className="text-[10px] uppercase text-ink/50">max retries</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase">Bump ×</span>
          <input
            className="brutal-input w-full"
            type="number"
            min={1}
            step={0.05}
            value={factor}
            disabled={phase === "running"}
            onChange={(e) =>
              setFactor(Math.max(1, parseFloat(e.target.value) || 1))
            }
          />
          <span className="text-[10px] uppercase text-ink/50">per block</span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {phase !== "running" ? (
          <button className="brutal-btn bg-flame text-white" onClick={run}>
            ▶ Run Escalation
          </button>
        ) : (
          <button className="brutal-btn bg-loss text-white" onClick={stop}>
            ■ Stop
          </button>
        )}
        <button
          className="brutal-btn bg-white"
          onClick={reset}
          disabled={phase === "running"}
        >
          ↺ Reset
        </button>
        <span className="pill bg-mint self-center">
          plan odds {fmtPct(finalOdds)}
        </span>
      </div>

      {factor < 1.125 && (
        <p className="mt-3 border-2 border-ink bg-bubble px-2 py-1 text-xs font-bold">
          ⚠ Bump under 1.125× may be rejected as a replacement transaction.
        </p>
      )}

      <div className="mt-4 border-3 border-ink">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-ink text-white">
            <tr className="text-left text-[10px] uppercase">
              <th className="px-2 py-1">Block</th>
              <th className="px-2 py-1 text-right">Tip</th>
              <th className="px-2 py-1 text-right">Max Fee</th>
              <th className="px-2 py-1 text-right">Odds</th>
              <th className="px-2 py-1 text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((rung, i) => {
              const attempt = attempts[i];
              const reached = i < attempts.length;
              return (
                <tr
                  key={rung.block}
                  className={`border-t-2 border-ink/10 ${
                    attempt?.included ? "bg-mint/40" : ""
                  }`}
                >
                  <td className="px-2 py-1 font-bold">+{rung.block}</td>
                  <td className="px-2 py-1 text-right">
                    {fmtGwei(rung.priorityFee)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {fmtGwei(rung.maxFee)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {fmtPct(rung.inclusionProbability)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {!reached ? (
                      <span className="text-ink/30">—</span>
                    ) : attempt?.included ? (
                      <span className="font-bold text-profit">mined ✓</span>
                    ) : (
                      <span className="text-loss">missed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] uppercase text-ink/60">
        Each block re-broadcasts the same nonce with a higher tip until mined.
        Odds use the live competing-tip distribution from the feed.
      </p>
    </section>
  );
}
