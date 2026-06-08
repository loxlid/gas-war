"use client";

import { fmtInt, fmtGwei, fmtTime } from "@/lib/format";

export type NonceStatus = "pending" | "included" | "dropped" | "replaced";

export interface PendingTx {
  id: string;
  nonce: number;
  /** Tip offered, gwei. */
  priorityFee: number;
  status: NonceStatus;
  /** Label for what the tx is doing. */
  label: string;
  timestamp: number;
}

interface Props {
  txs: PendingTx[];
  nextNonce: number;
  onQueue: () => void;
  onInclude: (id: string) => void;
  onDrop: (id: string) => void;
  onReset: () => void;
}

const statusStyle: Record<NonceStatus, string> = {
  pending: "bg-sunny",
  included: "bg-mint",
  dropped: "bg-loss text-white",
  replaced: "bg-white",
};

/**
 * Nonce manager: tracks the queue of pending transactions and their nonces in
 * local state. A stuck low nonce blocks every higher nonce behind it — the core
 * footgun of racing — so this panel makes the ordering explicit.
 */
export default function NonceManager({
  txs,
  nextNonce,
  onQueue,
  onInclude,
  onDrop,
  onReset,
}: Props) {
  const pending = txs.filter((t) => t.status === "pending").length;
  const lowestPending = txs
    .filter((t) => t.status === "pending")
    .reduce((min, t) => Math.min(min, t.nonce), Infinity);

  return (
    <section className="brutal-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl uppercase">Nonce Manager</h2>
        <span className="pill bg-white">next #{fmtInt(nextNonce)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="brutal-btn bg-mint" onClick={onQueue}>
          + Queue Tx
        </button>
        <button className="brutal-btn bg-white" onClick={onReset}>
          ↺ Reset
        </button>
        <span className="pill bg-sunny self-center">{pending} pending</span>
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto border-3 border-ink">
        {txs.length === 0 ? (
          <p className="p-4 text-center text-xs font-bold uppercase text-ink/50">
            No transactions queued — hit “Queue Tx”.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-ink text-white">
              <tr className="text-left text-[10px] uppercase">
                <th className="px-2 py-1">Nonce</th>
                <th className="px-2 py-1">Tip</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => {
                const blocked =
                  t.status === "pending" &&
                  Number.isFinite(lowestPending) &&
                  t.nonce > lowestPending;
                return (
                  <tr key={t.id} className="border-t-2 border-ink/10">
                    <td className="px-2 py-1 font-bold">
                      #{fmtInt(t.nonce)}
                      {blocked && (
                        <span className="ml-1 text-[10px] text-loss">
                          ⛓ blocked
                        </span>
                      )}
                      <div className="text-[10px] uppercase text-ink/50">
                        {fmtTime(t.timestamp)} · {t.label}
                      </div>
                    </td>
                    <td className="px-2 py-1">{fmtGwei(t.priorityFee)}</td>
                    <td className="px-2 py-1">
                      <span className={`pill ${statusStyle[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      {t.status === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <button
                            className="border-2 border-ink bg-mint px-2 py-0.5 text-[10px] font-bold uppercase"
                            onClick={() => onInclude(t.id)}
                          >
                            mine
                          </button>
                          <button
                            className="border-2 border-ink bg-loss px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                            onClick={() => onDrop(t.id)}
                          >
                            drop
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase text-ink/40">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-[11px] uppercase text-ink/60">
        A stuck low nonce blocks every higher nonce behind it. Mine or drop the
        lowest pending tx to unjam the queue.
      </p>
    </section>
  );
}
