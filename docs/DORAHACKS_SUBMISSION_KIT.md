# 🛡️ PortalSentinel — DoraHacks Portaldot Hacker House Submission Kit

> **Note (production hardening):** this is the original October 2026 hackathon narrative.
> For current capabilities, known limitations, and the P0/P1/P2 roadmap, see
> [`PRODUCTION_HARDENING_PLAN.md`](./PRODUCTION_HARDENING_PLAN.md). Claims here about live
> mempool streaming describe the intended architecture, not the shipped detection path.

> **Track:** Track 3: Node Operations & Tooling  
> **Network:** Portaldot V3 Testnet (`pallet-revive` RISC-V PolkaVM, Chain ID `420420777`)  
> **Submission Date:** October 2026  

---

## 1. Project Information

* **Project Name:** PortalSentinel
* **Tagline / One-Sentence Pitch:**  
  *Autonomous on-chain firewall and closed-loop circuit breaker for Portaldot V3 EVM that reacts to a configured drain signal, attempts an on-chain defense, and delivers Telegram advisories without requiring the user to keep a browser tab open. Current detection is block-poll based; see the production hardening plan for scope.*
* **Track:** Track 3 — Node Operations & Tooling (Node monitoring, security analysis, automated defense, and operator CLI tooling)
* **GitHub Repository:** [Public GitHub Repo](https://github.com/blackwrld04/PortalSentinel)
* **Live Demo URL:** `http://localhost:3002` (or public deploy)
* **Explorer Links:** [Portaldot Node Console Explorer](https://node-console.portaldot.dev/)
* **Contract Deployments:**
  * `SentinelRegistry.sol` (Policy & Emergency Safe Store)
  * `DefenseExecutor.sol` (Atomic Batch Revocation & Emergency Capital Sweep)
  * `MockERC20.sol` (`pUSD` Asset Fixture)
  * `MockExploitFixture.sol` (Reproducible Attack Simulator)

---

## 2. The Problem We Solve

In modern EVM ecosystems, a large share of user capital losses occur after users grant approvals to third-party smart contracts (DEX routers, bridges, yield aggregators). When one of these contracts is compromised by a zero-day vulnerability or private key leak:
1. Malicious drain transactions exploit pre-existing `transferFrom` allowances.
2. Attackers drain wallets in under **30 seconds** (often within 1–2 blocks).
3. Human response is far too slow: users are asleep, away from their desks, or unable to navigate revocation UIs in time.
4. Existing oracle-based revokers (e.g. Chainlink CRE or Tenderly alerts) suffer from **15–45 second consensus delays**, arriving *after* the attacker has already stolen the funds. Furthermore, standard ERC-20 tokens (like USDC/USDT) cannot be revoked by third parties without allowance.

---

## 3. The PortalSentinel Solution

PortalSentinel is a **closed-loop autonomous security firewall** built natively for **Portaldot V3 EVM**:

1. **Sub-Second Block Monitoring:**
   The Sentinel Daemon polls Portaldot V3 `pallet-revive` blocks, decodes the configured attack event, and evaluates it against a heuristic anomaly scoring matrix in **<1ms**. Mempool/pending-transaction inspection is planned for P1, not shipped today.
2. **Priority Fee Escalation:**
   When a critical threat is confirmed (score $\ge 60$), the daemon broadcasts an emergency counter-transaction with a **$1.35\times$ priority fee multiplier**, rising to 1.60× and 1.85× on retries. Higher fees improve inclusion odds but do **not** guarantee ordering ahead of the attacker.
3. **Universal Dual-Defense (Solving the ERC-20 Flaw):**  
   * **Atomic Batch Revocation:** Revokes compromised spenders on-chain where the token supports it, and verifies the allowance reached zero.
   * **Emergency Capital Sweep:** If a standard ERC-20 token cannot be externally revoked, the contract atomically sweeps the victim's remaining token balance into their pre-registered cold vault (`emergencySafe`). This protects funds still in the wallet; it cannot reverse a transfer that already mined.
4. **Zero-Custody Guarantee:**  
   By immutable smart contract design, the Sentinel Guardian operator can **never** withdraw or divert funds to itself. Funds can only be sent to the user's pre-configured cold vault.
5. **24/7 Autopilot Mobile Alerts (Telegram Bot):**  
   Users connect once and walk away. The daemon watches blocks 24/7/365. When a defense is dispatched, a Telegram advisory reports the real transaction hash, or explicitly says the action was a dry run or failed.
6. **Track 3 Operator CLI & Docker Suite:**  
   Full terminal tooling for node runners: `cli:health`, `cli:audit`, `cli:matrix`, `cli:benchmark`, `cli telegram:test`, and containerized deployment with `docker-compose.yml`.

---

## 4. Product Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PORTALSENTINEL SYSTEM                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Portaldot V3 Blocks] ──► [BlockStreamListener (1s poll)]             │
│                                      │                                 │
│                                      ▼ (<1ms)                          │
│                           [ThreatScorer Engine]                        │
│                           (Heuristic Anomaly Matrix)                   │
│                                      │                                 │
│                     ┌────────────────┴────────────────┐                │
│                     ▼                                 ▼                │
│          [TelegramNotifier]              [DefenseDispatcher]           │
│       (24/7 Push to Mobile Phone)         (1.35x – 1.85x Fees)         │
│       - Zero site visit required                      │                │
│       - Real hash or dry-run notice                   ▼ (dispatch)    │
│                                           [DefenseExecutor.sol]        │
│                                            (pallet-revive PolkaVM)     │
│                                                       │                │
│                                ┌──────────────────────┴──────────┐     │
│                                ▼                                 ▼     │
│                     [Batch Revocation]                [Emergency Sweep]│
│                     (Zeroes Allowances)               (Protects ERC20) │
│                                                                  │     │
│                                                                  ▼     │
│                                                        [Cold Safe Vault]│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Portaldot V3 Core Feature Alignment

* **`pallet-revive` (RISC-V PolkaVM):**  
  Uses Portaldot V3's sub-second block times (~1000ms) to shorten detection and dispatch latency relative to 12-second L1s. Actual inclusion and ordering depend on block timing, RPC behavior, and gas priority.
* **Native POT Gas Optimization:**  
  All defense actions, priority fee escalations, and registry configurations utilize native `POT` tokens for gas.
* **Dual Substrate & EVM Identity:**  
  Seamlessly bridges the user's native Substrate SS58 identity (`5FKcVpYCBtCCaeGP6ZDTdhKGgbNibGLoEbFTGJzkZodXh6jV`) with their EVM MetaMask account (`0x4d5a5FC178916ED51Ec0a02E38028f47AC2f6E67`).

---

## 6. Demo Video Walkthrough Script (< 3 Minutes)

* **[0:00 - 0:35] The Problem & Introduction:**  
  Introduce PortalSentinel as an autonomous block-monitoring circuit breaker for Portaldot V3 EVM. Explain how approval drains happen in seconds, leaving users with no time to react.
* **[0:35 - 1:10] The Dashboard & Guardian Bot:**  
  Show the dashboard, the living Sentinel Guardian Robot, and the connected Portaldot V3 testnet status. Note explicitly that the robot animation is decorative and that real scanning runs in the daemon.
* **[1:10 - 2:05] Defense Walkthrough (The Showpiece):**
  Click **"RUN DEFENSE WALKTHROUGH"**. Show the 5-phase decision path locally:
  1. Signal Observed → 2. Threat Scored (100/100) → 3. 1.35x Fee Escalation Planned → 4. Revocation Would Be Sent → 5. Remaining Funds Would Be Swept. State that this UI preview does not broadcast a transaction.
* **[2:05 - 2:35] Telegram Advisories (Autopilot):**
  Demonstrate the Telegram alert section. Explain that the daemon monitors continuously without the website open. Label the phone mockup as illustrative and show the CLI test command instead of claiming a live ping from the browser.
* **[2:35 - 3:00] Node Operator CLI & Conclusion:**  
  Show the terminal CLI suite (`npm run cli health`, `npm run cli audit`). Conclude with our vision for long-term integration into the Portaldot validator ecosystem.
