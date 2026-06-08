"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FeeFeed from "@/components/FeeFeed";
import FeedControls from "@/components/FeedControls";
import BidCalculator from "@/components/BidCalculator";
import NonceManager, {
  type PendingTx,
  type NonceStatus,
} from "@/components/NonceManager";
import RetrySimulator from "@/components/RetrySimulator";
import { FeeFeed as FeeFeedEngine, type GasBlock } from "@/lib/feeFeed";
import { recommendPriorityFee } from "@/lib/gas";

const HISTORY_CAP = 80;
const LABELS = ["mint", "swap", "approve", "claim", "snipe", "bridge"];

export default function Page() {
  const [block, setBlock] = useState<GasBlock | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [running, setRunning] = useState(false);

  // Bid calculator inputs.
  const [urgency, setUrgency] = useState(0.7);
  const [bufferPct, setBufferPct] = useState(25);
  const [gasLimit, setGasLimit] = useState(120_000);
  const [armedTip, setArmedTip] = useState(3);

  // Nonce manager state.
  const [txs, setTxs] = useState<PendingTx[]>([]);
  const [nextNonce, setNextNonce] = useState(42);

  const feedRef = useRef<FeeFeedEngine | null>(null);
  const blockRef = useRef<GasBlock | null>(null);

  const handleBlock = useCallback((b: GasBlock) => {
    blockRef.current = b;
    setBlock(b);
    setHistory((h) => {
      const next = [...h, b.baseFeePerGas];
      return next.length > HISTORY_CAP ? next.slice(-HISTORY_CAP) : next;
    });
  }, []);

  const startFeed = useCallback(() => {
    if (feedRef.current) return;
    const feed = new FeeFeedEngine({ intervalMs: 2000 });
    feed.subscribe(handleBlock);
    feedRef.current = feed;
    feed.start();
    setRunning(true);
  }, [handleBlock]);

  const stopFeed = useCallback(() => {
    feedRef.current?.stop();
    feedRef.current = null;
    setRunning(false);
  }, []);

  // Autostart the feed on mount; clean up on unmount.
  useEffect(() => {
    startFeed();
    return () => {
      feedRef.current?.stop();
      feedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nonce manager actions.
  const queueTx = useCallback(() => {
    const b = blockRef.current;
    const tip = b
      ? recommendPriorityFee(b.baseFeePerGas, urgency, b.tips)
      : armedTip;
    setTxs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nonce: nextNonce,
        priorityFee: tip,
        status: "pending" as NonceStatus,
        label: LABELS[Math.floor(Math.random() * LABELS.length)],
        timestamp: Date.now(),
      },
      ...prev,
    ]);
    setNextNonce((n) => n + 1);
  }, [nextNonce, urgency, armedTip]);

  const setStatus = useCallback((id: string, status: NonceStatus) => {
    setTxs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t)),
    );
  }, []);

  const resetNonces = useCallback(() => {
    setTxs([]);
    setNextNonce(42);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="brutal-card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight">
            Gas War Room
          </h1>
          <p className="mt-1 text-xs font-bold uppercase text-ink/60">
            Priority-fee bidding engine · simulated data · not financial advice
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill bg-sunny">Next.js</span>
          <span className="pill bg-mint">EIP-1559</span>
          <span className="pill bg-flame text-white">
            {running ? "Live Feed" : "Paused"}
          </span>
        </div>
      </header>

      <div className="mb-6">
        <FeedControls running={running} onStart={startFeed} onStop={stopFeed} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <FeeFeed block={block} baseFeeHistory={history} running={running} />
          <RetrySimulator
            block={block}
            armedTip={armedTip}
            bufferPct={bufferPct}
          />
        </div>

        <div className="flex flex-col gap-6">
          <BidCalculator
            block={block}
            urgency={urgency}
            bufferPct={bufferPct}
            gasLimit={gasLimit}
            onUrgencyChange={setUrgency}
            onBufferChange={setBufferPct}
            onGasLimitChange={setGasLimit}
            onArm={setArmedTip}
          />
          <NonceManager
            txs={txs}
            nextNonce={nextNonce}
            onQueue={queueTx}
            onInclude={(id) => setStatus(id, "included")}
            onDrop={(id) => setStatus(id, "dropped")}
            onReset={resetNonces}
          />
        </div>
      </div>

      <footer className="mt-8 text-center text-[11px] font-bold uppercase text-ink/50">
        Demo with simulated data. A real bidding bot would sign and broadcast
        EIP-1559 transactions from a secure backend — never expose private keys
        in the browser.
      </footer>
    </main>
  );
}
