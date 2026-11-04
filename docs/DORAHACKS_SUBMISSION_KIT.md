# PortalSentinel: Autonomous On-Chain Security Firewall & Circuit Breaker for Portaldot V3

- **Track:** Track 3 — Node Operations & Tooling
- **Portaldot V3 Testnet Wallet Address (SubWallet SS58):** `5EF5e8yASsVqweYRo13nMXxgkxCC8mYPNarcRqY7a8S7Pyni`
- **Live Web3 DApp:** https://portal-sentinel-pi.vercel.app/
- **Live Demo Video (02:21 with Voice-Over):** https://portal-sentinel-pi.vercel.app/demo.mp4
- **Pitch Deck (9-Slide PDF):** https://portal-sentinel-pi.vercel.app/PortalSentinel-Pitch-Deck.pdf
- **Pitch Deck (Interactive HTML):** https://portal-sentinel-pi.vercel.app/pitch-deck.html
- **Official Logo (1024×1024 PNG):** https://portal-sentinel-pi.vercel.app/logo.png
- **GitHub Repository:** https://github.com/Blackwrld04/PortalSentinel
- **Live Telemetry & Prometheus Endpoints:**
  - JSON Health: https://portal-sentinel-pi.vercel.app/api/health
  - Prometheus Metrics: https://portal-sentinel-pi.vercel.app/api/metrics

---

## 1. The Problem: Why Passive Security Fails in DeFi

DeFi users routinely grant unlimited ERC-20 token approvals (`type(uint256).max`) to routers, bridges, and vaults. When a third-party protocol is compromised by a zero-day exploit or private-key leak, attackers drain wallets via `transferFrom` in seconds.

- **The Human Latency Gap:** Users are asleep or away from their keyboard. Manual revocation requires noticing the exploit, opening a revocation UI, connecting a wallet, and signing a transaction—taking minutes or hours while drains finish in seconds.
- **Oracle Consensus Lag (15–45s):** Multi-node oracle networks require Byzantine consensus rounds before firing a callback, arriving after the attacker's drain transaction has already finalized.
- **The Standard ERC-20 Revocation Flaw:** Standard ERC-20 `approve(spender, 0)` only modifies allowance for `msg.sender`. An external security contract cannot overwrite a user's allowance on standard ERC-20 tokens unless the token implements a dedicated guardian revocation hook—meaning naive revokers silently fail.

---

## 2. How It Works: Closed-Loop Dual-Defense Architecture

PortalSentinel is an autonomous closed-loop security daemon, non-custodial smart-contract circuit breaker, and Track 3 node operator toolkit purpose-built for **Portaldot V3 EVM (`pallet-revive` RISC-V PolkaVM, Chain ID `420420777`)**:

```text
[Portaldot V3 RPC (pallet-revive ~1,000ms Blocks)]
                       │
                       ▼
[1. BlockStreamListener] ──► Crash-safe block cursor journal + RPC failover
                       │
                       ▼
[2. ThreatScorer]        ──► Heuristic risk matrix (0–100) vs. user's on-chain DefenseMode
                       │     (Conservative: 80 | Balanced: 60 | Aggressive: 40)
                       ▼
[3. On-Chain Pre-Check]  ──► Queries live allowance() & balanceOf() before broadcasting
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
[Path A: Atomic Batch Revoke]  [Path B: Emergency Capital Sweep]
Calls guardianRevokeApproval   Evacuates standard ERC-20 balances via SafeERC20
and verifies post-call         directly to the user's immutable emergencySafe
allowance == 0 on-chain        (Priority gas ladder: 1.35× → 1.60× → 1.85×)
          └────────────┬────────────┘
                       ▼
[4. 24/7 Telegram Bot (@PortalSentinel_Alerts_bot) & Prometheus /metrics]
```

### Zero-Custody Mathematical Invariant
Even if the off-chain Guardian operator key is compromised, `DefenseExecutor.sol` makes stealing user funds mathematically impossible:
- Swept tokens can **only** be transferred to the `emergencySafe` address registered by the user in `SentinelRegistry.sol`.
- Setting `emergencySafe == address(0)` or `emergencySafe == guardian` reverts on-chain (`InvalidEmergencySafe`).
- If a defense call results in zero actual revocations or sweeps, the transaction reverts (`NoDefenseExecuted`) so the daemon never reports a false-positive rescue.

---

## 3. Key Features

- **Dual-Defense Smart Contracts (`SentinelRegistry.sol` & `DefenseExecutor.sol`):** Supports three on-chain sensitivity modes (`CONSERVATIVE`, `BALANCED`, `AGGRESSIVE`), atomic batch allowance revocation with post-call zero-allowance verification, and non-custodial cold-safe capital sweeps.
- **Native SubWallet Extension Integration (`window.injectedWeb3['subwallet-js']`):** One-click SubWallet extension popup connection and cryptographic policy signing for Portaldot V3 Testnet accounts (`5EF5e8yASsVqweYRo13nMXxgkxCC8mYPNarcRqY7a8S7Pyni`).
- **Priority Fee Escalation Ladder:** Automatically escalates EIP-1559 priority gas (`1.35× → 1.60× → 1.85×`) in native `POT` with fresh nonce synchronization on retry.
- **24/7 Mobile Shield via Telegram (`@PortalSentinel_Alerts_bot`):** Users enroll once and close their browser. The daemon pushes real-time mobile threat alerts and confirmed on-chain defense receipts with direct Portaldot Node Console links.
- **Track 3 Node Operator CLI Suite:**
  - `npm run cli:health` — Probes Portaldot V3 EVM & Substrate RPC roundtrip latency, block height, and gas price.
  - `cd daemon && npm run cli audit <address>` — Scans any account on Portaldot V3 for active token allowances and computes a live exposure score.
  - `npm run cli:benchmark` — Runs multi-sample p50/p95 RPC latency and block cadence benchmarks.
  - `npm run cli:metrics` — Queries the live `/health` and `/metrics` Prometheus telemetry endpoints.
- **Interactive Web3 Dashboard:** Native SubWallet connection to Portaldot V3 Testnet (`Chain ID: 420420777`), live Autonomous Circuit Breaker Policy Studio (`enrollPolicy`, `updateEmergencySafe`, `updateDefenseMode`, `disarmShield`), Live On-Chain Allowance Scanner, and interactive 5-stage Closed-Loop Defense Sandbox.

---

## 4. Tech Stack

- **Smart Contracts:** Solidity 0.8.24, Foundry (`forge`), OpenZeppelin Contracts v5 (`Ownable`, `Pausable`, `ReentrancyGuard`, `SafeERC20`), Yul (`pallet-revive` storage-deposit optimized bytecode).
- **Autonomous Daemon & Node CLI:** TypeScript 5.6, Node.js 20, ethers.js v6, native HTTP Prometheus `/metrics` & `/health` server, Telegram Bot HTTP API.
- **Frontend Dashboard:** React 18, TypeScript, Vite 6, Tailwind CSS, Lucide Icons, SubWallet Polkadot Extension API (`window.injectedWeb3['subwallet-js']`), ethers.js v6.
- **DevOps & Deployment:** Multi-stage `Dockerfile`, `docker-compose.yml` for colocated validator nodes, Vercel, and Render Blueprint (`render.yaml`).

---

## 5. Portaldot V3 Testnet Deployment Proof (Chain ID: 420420777)

All 4 smart contracts are deployed, verified, and linked live on **Portaldot V3 Testnet** (`https://test-evm-rpc-v3.portaldot.dev`):

- **Portaldot V3 Testnet Wallet Address (Funded with Testnet POT in SubWallet):** `5EF5e8yASsVqweYRo13nMXxgkxCC8mYPNarcRqY7a8S7Pyni`

| Contract | Portaldot V3 Testnet Address | Block | Deployment Transaction Hash |
| :--- | :--- | :--- | :--- |
| **`SentinelRegistry.sol`** | `0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF` | `#311022` | `0xcf77198f0b1666c4084441d61db60a39f6a07981a9c9605fb4341689ba48336c` |
| **`DefenseExecutor.sol`** | `0x89c9510c4b3AeEE8792De383D251ef0b61d406E2` | `#311067` | `0x4cdd30974731623f7e9b2e25768d328669a4207ac5d0b7ea8aa0135ae31220f0` |
| **`MockERC20.sol` (`pUSD`)** | `0x25da2DeD5b0Da07C160e021e0Df636988C3657f5` | `#311161` | `0xf959f9ea03878c9ff0472ee3343f0c50c2be0a8fc119a41d6b83de2c250b515b` |
| **`MockExploitFixture.sol`** | `0xc44a87FE907E497E50ffF6913c0b863bd0758a90` | `#310782` | `0xcfdbdcf2d2807b19a5b8b00a5e4c0b7ee69cffd8e9df89be1c4e596a9fe1b941` |
| **Registry → Executor Link (`setDefenseExecutor`)** | `0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF` | `#311068` | `0x9298f248fb8b53534ca7ae243331e162848ccbb36edbc66b4fba2971a181a0b4` |

**Automated Test Suite:** `12/12` Foundry smart-contract unit & invariant tests passing (`npm run test:contracts`) + `15/15` daemon unit tests passing (`npm run test:unit`).
