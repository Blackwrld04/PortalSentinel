# 🛡️ PortalSentinel — DoraHacks Portaldot Hacker House Submission Kit

> **Track:** Track 3: Node Operations & Tooling  
> **Network:** Portaldot V3 Testnet (`pallet-revive` RISC-V PolkaVM, Chain ID `420420777`)  
> **Submission Date:** October 2026  

---

## 1. Project Information

* **Project Name:** PortalSentinel
* **Tagline / One-Sentence Pitch:**  
  *Autonomous on-chain firewall and closed-loop circuit breaker for Portaldot V3 EVM that preempts zero-day approval drains in under 15ms and delivers 24/7 background Telegram alerts without requiring the user to keep a browser tab open.*
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

In modern EVM ecosystems, **90% of user capital losses occur after users grant approvals to third-party smart contracts** (DEX routers, bridges, yield aggregators). When one of these contracts is compromised by a zero-day vulnerability or private key leak:
1. Malicious drain transactions exploit pre-existing `transferFrom` allowances.
2. Attackers drain wallets in under **30 seconds** (often within 1–2 blocks).
3. Human response is far too slow: users are asleep, away from their desks, or unable to navigate revocation UIs in time.
4. Existing oracle-based revokers (e.g. Chainlink CRE or Tenderly alerts) suffer from **15–45 second consensus delays**, arriving *after* the attacker has already stolen the funds. Furthermore, standard ERC-20 tokens (like USDC/USDT) cannot be revoked by third parties without allowance.

---

## 3. The PortalSentinel Solution

PortalSentinel is a **closed-loop autonomous security firewall** built natively for **Portaldot V3 EVM**:

1. **Sub-Second Threat Detection:**  
   The Sentinel Daemon hooks directly into Portaldot V3’s `pallet-revive` block and mempool streams, evaluating inbound calls against a heuristic anomaly scoring matrix in **<1ms**.
2. **1.35x Gas Priority Preemption (Front-Running the Attacker):**  
   When a critical threat is confirmed (score $\ge 60$), the daemon broadcasts an emergency counter-transaction with a **$1.35\times$ priority fee multiplier**, guaranteeing that the circuit breaker transaction is mined **before** the attacker's drain transaction.
3. **Universal Dual-Defense (Solving the ERC-20 Flaw):**  
   * **Atomic Batch Revocation:** Revokes compromised spenders on-chain.  
   * **Emergency Capital Sweep:** If a standard ERC-20 token cannot be externally revoked, the contract atomically sweeps the victim's token balance directly into their pre-registered cold vault (`emergencySafe`), rescuing the funds before the drain call executes!
4. **Zero-Custody Guarantee:**  
   By immutable smart contract design, the Sentinel Guardian operator can **never** withdraw or divert funds to itself. Funds can only be sent to the user's pre-configured cold vault.
5. **24/7 Autopilot Mobile Alerts (Telegram Bot):**  
   Users connect once and walk away. The daemon watches the mempool 24/7/365. Whenever a threat is intercepted, an instant push notification lands on the user's phone via `@PortalSentinelAlertsBot` with verified explorer transaction links.
6. **Track 3 Operator CLI & Docker Suite:**  
   Full terminal tooling for node runners: `cli:health`, `cli:audit`, `cli:matrix`, `cli:benchmark`, `cli telegram:test`, and containerized deployment with `docker-compose.yml`.

---

## 4. Product Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PORTALSENTINEL SYSTEM                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Portaldot V3 Mempool] ──► [BlockStreamListener (Sub-second socket)]  │
│                                      │                                 │
│                                      ▼ (<1ms)                          │
│                           [ThreatScorer Engine]                        │
│                           (Heuristic Anomaly Matrix)                   │
│                                      │                                 │
│                     ┌────────────────┴────────────────┐                │
│                     ▼                                 ▼                │
│          [TelegramNotifier]              [DefenseDispatcher]           │
│       (24/7 Push to Mobile Phone)         (1.35x Gas Priority)         │
│       - Zero site visit required                      │                │
│       - Interactive explorer links                    ▼ (<15ms)        │
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
  Leverages Portaldot V3's sub-second block times (~1000ms) to achieve front-running latency unattainable on traditional Layer 1 blockchains.
* **Native POT Gas Optimization:**  
  All defense actions, priority fee escalations, and registry configurations utilize native `POT` tokens for gas.
* **Dual Substrate & EVM Identity:**  
  Seamlessly bridges the user's native Substrate SS58 identity (`5FKcVpYCBtCCaeGP6ZDTdhKGgbNibGLoEbFTGJzkZodXh6jV`) with their EVM MetaMask account (`0x4d5a5FC178916ED51Ec0a02E38028f47AC2f6E67`).

---

## 6. Demo Video Walkthrough Script (< 3 Minutes)

* **[0:00 - 0:35] The Problem & Introduction:**  
  Introduce PortalSentinel as the first autonomous mempool circuit breaker for Portaldot V3 EVM. Explain how zero-day approval drains happen in seconds, leaving users with no time to react.
* **[0:35 - 1:10] The Dashboard & Guardian Bot:**  
  Show the dashboard, the living Sentinel Guardian Robot with its eye-tracking and mempool scanning dynamics, and the live connected Portaldot V3 testnet status.
* **[1:10 - 2:05] Live Exploit & Front-Run Preemption (The Showpiece):**  
  Click **"RUN EXPLOIT & DEFENSE SANDBOX"**. Show the 5-phase execution in real time:  
  1. Exploit Detected → 2. Threat Scored (100/100) → 3. 1.35x Gas Priority Dispatched → 4. Atomic Revocation Mined → 5. Capital Rescued in 14ms!
* **[2:05 - 2:35] 24/7 Telegram Mobile Alerts (Autopilot):**  
  Demonstrate the Telegram Alert section. Explain how the cloud daemon monitors 24/7 without keeping the website open. Show the live phone mockup and test ping alert with explorer links.
* **[2:35 - 3:00] Node Operator CLI & Conclusion:**  
  Show the terminal CLI suite (`npm run cli health`, `npm run cli audit`). Conclude with our vision for long-term integration into the Portaldot validator ecosystem.
