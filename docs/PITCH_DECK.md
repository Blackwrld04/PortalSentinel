# 📊 PortalSentinel — Pitch Deck Outline

> **Portaldot Hacker House 2026 · Track 3: Node Operations & Tooling**

---

### Slide 1: Cover
* **Title:** PortalSentinel
* **Subtitle:** Autonomous Closed-Loop Security Firewall & Circuit Breaker for Portaldot V3 EVM
* **Presenter:** PortalSentinel Core Team
* **Track:** Track 3 (Node Operations & Tooling)

---

### Slide 2: The Multi-Billion Dollar Approval Dilemma
* **The Reality:** Users routinely sign "Unlimited Allowances" (`type(uint256).max`) to interact with DEXs, bridges, and yield vaults.
* **The Vulnerability:** When a protocol router is compromised, attackers drain user balances via `transferFrom` in seconds.
* **The Gap:**
  * Manual revocation is too slow (human latency: hours/days).
  * Oracle consensus is too slow (Chainlink CRE latency: 15–45 seconds).
  * Standard ERC-20 tokens cannot be revoked by third parties.

---

### Slide 3: Introducing PortalSentinel
* **Autonomous Circuit Breaker:** Detects, scores, and preempts exploit transactions in under **15 milliseconds**.
* **Mempool Front-Running:** Uses a $1.35\times$ priority gas fee multiplier on Portaldot V3 EVM to mine defense transactions *before* the attacker's drain is finalized.
* **Dual-Defense Architecture:**
  1. *Atomic Batch Revocation:* Sets allowances to zero.
  2. *Emergency Capital Sweep:* Sweeps funds to the user's pre-configured cold vault, completely solving the ERC-20 limitation.

---

### Slide 4: Zero-Custody Smart Contract Invariant
* **Non-Custodial Architecture:** The Sentinel Guardian key can NEVER divert or withdraw funds to itself.
* **Contract Guarantee:** Funds can strictly and only be transferred to the user’s pre-registered `emergencySafe`.
* **Audited Logic:** 100% Foundry test pass rate across all attack vectors.

---

### Slide 5: Why Portaldot V3 (`pallet-revive`) is Essential
* **Sub-Second Block Times:** Portaldot V3's ~1000ms block production enables real-time mempool preemption that is physically impossible on 12-second EVM networks.
* **PolkaVM Efficiency:** RISC-V execution provides the low bytecode interpretation latency needed for high-frequency defense.
* **Unified Gas Token (`POT`):** Zero gas friction with native POT priority fee escalation.

---

### Slide 6: 24/7 Mobile Shield (Telegram Bot Autopilot)
* **Zero Site Visits Required:** Once registered, users do not need to keep browser tabs open.
* **Cloud Daemon Watchdog:** Operates 24/7/365 in validator node infrastructure.
* **Real-Time Push Alerts:** Telegram Bot pushes verified security advisories, latency telemetry, and Portaldot Node Console explorer links directly to user smartphones.

---

### Slide 7: Track 3 Tooling & Node Operations Suite
* **CLI Inspection Tools:**
  * `npm run cli health` — Substrate & EVM node latency and gas probe
  * `npm run cli audit <address>` — On-chain allowance risk scanner
  * `npm run cli matrix` — Threat scoring rule inspector
  * `npm run cli benchmark` — Multi-request RPC latency probe
* **Dockerized Deployment:** Single-command `docker compose up -d` for node runners.

---

### Slide 8: Business Model & Long-Term Roadmap
* **Target Audience:** Portaldot DeFi users, DAOs, protocol treasuries, and node operators.
* **Monetization & Sustainability:**
  * Free tier for individual retail wallets.
  * Premium tier for institutional vaults and high-TVL protocols (dedicated validator mempool peering, custom sweep rules, SLA guarantees).
* **Portaldot Ecosystem Grants:** Seeking long-term builder support from the Portaldot Network Ecosystem Foundation for mainnet deployment and validator integration.

---

### Slide 9: Team & Summary
* **Summary:** PortalSentinel replaces passive post-incident forensics with proactive, autonomous on-chain defense.
* **Call to Action:** Test the live sandbox at `http://localhost:3002` or run `npm run cli:health`!
