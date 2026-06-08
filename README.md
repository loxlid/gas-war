# Gas-War

![CI](https://github.com/loxlid/gas-war/actions/workflows/ci.yml/badge.svg) ![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

An **EIP-1559 priority-fee bidding engine** for winning competitive on-chain races — NFT mints, liquidations, claim windows, anything where landing in the *next* block matters. Gas-War is a browser dashboard that estimates the priority fee you need to hit a target inclusion probability, manages your nonce pipeline, and runs an **adaptive retry escalator** that ladders the tip block-by-block until the transaction is included.

All data in the live demo is **simulated** (a random-walk fee feed) so the UI runs with zero RPC or wallet setup. The fee-math core is pure and reusable against a real provider.

> Demo: **https://gas-war.vercel.app**

---

## Why this exists

Under EIP-1559 every transaction pays `baseFee` (burned, set by the protocol) plus a `priorityFee` tip that goes to the validator. In a race, the tip *is* the auction: bid too low and you miss the block, bid too high and you overpay on every attempt. Winning consistently is a problem of **estimating the marginal tip** that clears the next block, then **escalating intelligently** if you miss — without nuking your wallet on gas.

Gas-War models that auction.

## Features

- **Live fee feed** — a simulated `baseFee` / priority-fee percentile stream (`p10 / p50 / p90`) on a random walk, so the dashboard is alive without a node.
- **Bid calculator** — input urgency / target inclusion probability, get a recommended `maxPriorityFeePerGas` and `maxFeePerGas` (with a base-fee buffer so the tx stays valid if the base fee rises).
- **Nonce manager** — tracks pending nonces in local state so you can pipeline transactions without nonce-gap stalls or replacement collisions.
- **Adaptive retry simulator** — picks a starting tip, then escalates it across N blocks by a configurable factor until the (simulated) block includes it, showing the full bid ladder and total gas spent.

## The math (`lib/gas.ts`)

The core is pure TypeScript so it can be unit-tested and reused against a real RPC:

- `recommendPriorityFee(baseFee, urgency, recentTips[])` — picks a tip off the recent-tip distribution, scaled by urgency.
- `maxFeePerGas(baseFee, priorityFee, bufferPct)` — `baseFee * (1 + buffer) + priorityFee`, so the cap survives a base-fee bump between signing and inclusion.
- `escalationSchedule(initialTip, blocks, factor)` — the geometric bid ladder used by the retry simulator.
- `estimateInclusionProbability(tip, percentileTips)` — maps a tip onto the recent-tip percentile curve.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — comic/terminal aesthetic
- Pure fee-math lib, mock data feed (no wallet, no RPC required)

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

## Deploy

Push to GitHub and import into Vercel (framework auto-detected as Next.js), or:

```bash
npm run build && npm start
```

## Disclaimer

This is an **educational simulator**. The fee feed is randomly generated and the inclusion model is a simplification of real mempool dynamics — it is **not** connected to a live network and does **not** submit transactions. Wire `lib/gas.ts` to a real provider (viem / ethers) and a real fee oracle before trusting any number against mainnet.

## License

MIT © 2026 Loxee
