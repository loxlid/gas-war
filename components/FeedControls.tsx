"use client";

interface Props {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
}

/** Minimal start/stop controls for the simulated gas feed. */
export default function FeedControls({ running, onStart, onStop }: Props) {
  return (
    <section className="brutal-card flex flex-wrap items-center gap-3 p-5">
      <h2 className="font-display text-xl uppercase">Feed</h2>
      {!running ? (
        <button className="brutal-btn bg-mint" onClick={onStart}>
          ▶ Start Feed
        </button>
      ) : (
        <button className="brutal-btn bg-loss text-white" onClick={onStop}>
          ■ Pause Feed
        </button>
      )}
      <p className="text-[11px] uppercase text-ink/60">
        Simulated EIP-1559 blocks · ~2s cadence · no real RPC
      </p>
    </section>
  );
}
