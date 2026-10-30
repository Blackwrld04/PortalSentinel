# 🛡️ PortalSentinel — Autonomous On-Chain Security Firewall & Closed-Loop Circuit Breaker

> **Built for Portaldot Hacker House 2026 (Track 3: Node Operations & Tooling)**  
> *Autonomous front-running defense, zero-custody security scoping, and live telemetry for Portaldot V3 (`pallet-revive`).*

---

## 🌟 Overview

When DeFi protocols, routers, or validators are exploited, malicious actors drain user wallets via pre-existing ERC-20 allowances in under 30 seconds. By the time human operators notice and manually revoke, funds are gone.

**PortalSentinel** eliminates the human in the critical response path:
* **Real-Time Threat Detection:** Listens continuously to Portaldot V3 block streams (`pallet-revive` EVM RPC + Substrate WebSocket).
* **Front-Running Autonomous Defense:** When an anomalous outflow, unverified drainer, or slashing event is detected, PortalSentinel dispatches an emergency transaction with **$1.35\times$ priority gas** to front-run the attacker.
* **Zero-Custody Guarantee:** The Sentinel Guardian agent is **non-custodial** by smart contract invariant. It can *only* zero out allowances (`executeEmergencyBatchRevoke`) or sweep tokens to the user’s pre-registered cold vault (`executeEmergencySweep`). It can never touch or withdraw funds to itself.

---

## 🏛️ Architecture

```
┌────────────────────────────────────────────────────────┐
│         LAYER 4: COMMAND CENTER & TELEMETRY UI         │
│  • Next.js / Vite + React 18 + Lucide                  │
│  • Active Approvals Scanner & 1-Click Shield Opt-in    │
│  • Interactive "Simulate Exploit Attack" Sandbox       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      LAYER 2 & 3: SENTINEL WATCHER DAEMON (TS)         │
│  • Dual-RPC Stream Listener (EVM + Substrate)          │
│  • Threat Scoring Engine (Outflow velocity & signatures)
│  • Priority Fee Escalator & High-Speed Dispatcher      │
└───────────────────────────┬────────────────────────────┘
                            │ (High-Priority Emergency Tx)
                            ▼
┌────────────────────────────────────────────────────────┐
│     LAYER 1: ON-CHAIN DEFENSE CORE (PORTALDOT EVM)     │
│  • SentinelRegistry.sol — Policy & fallback safe store │
│  • DefenseExecutor.sol — Atomic batch revoke & sweep   │
│  • MockExploitFixture.sol — Reproducible attack testbed│
└────────────────────────────────────────────────────────┘
```

---

## 🌐 Portaldot V3 Network Configuration

* **Network Name:** Portaldot V3 Testnet
* **Execution Environment:** `pallet-revive` (PolkaVM RISC-V + REVM)
* **Chain ID (EVM):** `420420777` (`0x190f1ca9`)
* **EVM RPC Endpoint:** `https://test-evm-rpc-v3.portaldot.dev`
* **Substrate Node URL:** `wss://test-node-v3.portaldot.dev`
* **Node Explorer:** [https://node-console.portaldot.dev/](https://node-console.portaldot.dev/)

---

## 🚀 Quickstart Guide

### 1. Smart Contracts (Foundry)
```bash
cd contracts

# Run all 6 automated invariant and security tests
forge test -v

# Build deployment artifacts
forge build
```

### 2. Sentinel Watcher Daemon
```bash
cd daemon

# Run the live testnet attack simulation harness
npm run simulate

# Start continuous block stream monitor
npm start
```

### 3. Frontend Command Center & Sandbox
```bash
cd frontend

# Run local development server (http://localhost:3000)
npm run dev

# Or build for production
npm run build
```

---

## 🧪 Interactive Hackathon Judge Sandbox

Judges can verify the closed-loop defense mechanism in under 60 seconds:
1. Open the Frontend Command Center or run `npm run simulate` in `daemon/`.
2. Click **[🚨 Simulate Exploit Attack on Testnet]**.
3. Watch the 4-step sequence:
   * **Step 01:** Attacker initiates `transferFrom` drain attempt.
   * **Step 02:** Sentinel Daemon flags threat (Score: 100/100 - CRITICAL).
   * **Step 03:** Priority gas escalation ($1.35\times$) broadcasts emergency revocation.
   * **Step 04:** Transaction confirmed! Allowance zeroed. Capital saved.
   * View the verified transaction hash directly on the Portaldot Node Console.

---

## 📑 Verifiable On-Chain Proofs

See [`docs/PROOF.md`](docs/PROOF.md) for full testnet verification instructions, curl terminal queries, and contract addresses.
