import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GAS WAR ROOM — Priority-Fee Bidding Engine",
  description:
    "A web UI for an EIP-1559 priority-fee bidding engine. Watch a live fee feed, compute a winning maxPriorityFeePerGas / maxFeePerGas bid, manage pending nonces, and run an adaptive retry escalation. Demo with simulated data.",
  keywords: [
    "gas",
    "priority fee",
    "EIP-1559",
    "maxFeePerGas",
    "nonce",
    "NFT mint",
    "MEV",
    "DeFi",
    "web3",
  ],
  authors: [{ name: "Loxee" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
