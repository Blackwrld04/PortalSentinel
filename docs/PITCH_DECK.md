# 📊 PortalSentinel — Pitch Deck Outline

> **Note (production hardening):** this is the original October 2026 hackathon narrative.
> See [`PRODUCTION_HARDENING_PLAN.md`](./PRODUCTION_HARDENING_PLAN.md) for current
> capabilities and remaining gaps.

> **Portaldot Hacker House 2026 · Track 3: Node Operations & Tooling**

---

### Slide 1: Cover
* **Title:** PortalSentinel
* **Subtitle:** Autonomous Closed-Loop Security Firewall & Circuit Breaker for Portaldot V3 EVM
* **Presenter:** PortalSentinel Core Team
* **Track:** Track 3 (Node Operations & Tooling)
* **Portaldot V3 Testnet Wallet Address (SubWallet SS58):** `5EF5e8yASsVqweYRo13nMXxgkxCC8mYPNarcRqY7a8S7Pyni`
* **Live Pitch Deck:** `https://portal-sentinel-pi.vercel.app/pitch-deck.html`

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
* **Autonomous Circuit Breaker:** Detects a configured drain signal, scores it, and dispatches an on-chain defense. Detection is currently block-poll based; dispatch latency is measured and reported, not guaranteed.
* **Priority Fee Escalation:** Uses a $1.35\times$ to $1.85\times$ priority fee multiplier on Portaldot V3 EVM to improve inclusion odds. Ordering ahead of the attacker is not guaranteed.
* **Dual-Defense Architecture:**
  1. *Atomic Batch Revocation:* Sets allowances to zero and verifies the result.
  2. *Emergency Capital Sweep:* Sweeps remaining funds to the user's pre-configured cold vault, addressing the ERC-20 third-party revocation limit.

---

### Slide 4: Zero-Custody Smart Contract Invariant
* **Non-Custodial Architecture:** The Sentinel Guardian key can NEVER divert or withdraw funds to itself.
* **Contract Guarantee:** Funds can strictly and only be transferred to the user’s pre-registered `emergencySafe`.
* **Audited Logic:** 12/12 Foundry tests passing, including a fuzz sweep invariant. These are internal tests, not an external audit.

---

### Slide 5: Why Portaldot V3 (`pallet-revive`) is Essential
* **Sub-Second Block Times:** Portaldot V3's ~1000ms block production shortens the detect-to-dispatch window compared with 12-second EVM networks. Actual preemption still depends on block timing, RPC behavior, and gas priority.
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

### Slide 9: Live Testnet Proof & Conclusion
* **Portaldot V3 Testnet Wallet Address (SubWallet SS58):** `5EF5e8yASsVqweYRo13nMXxgkxCC8mYPNarcRqY7a8S7Pyni`
* **Live Deployed Contracts on Portaldot V3 Testnet (`Chain ID: 420420777`):**
  * `SentinelRegistry.sol`: `0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF` (Block `#311022`)
  * `DefenseExecutor.sol`: `0x89c9510c4b3AeEE8792De383D251ef0b61d406E2` (Block `#311067`)
  * `MockERC20.sol (pUSD)`: `0x25da2DeD5b0Da07C160e021e0Df636988C3657f5` (Block `#311161`)
  * `MockExploitFixture.sol`: `0xc44a87FE907E497E50ffF6913c0b863bd0758a90` (Block `#310782`)
* **Summary:** PortalSentinel replaces passive post-incident forensics with proactive, autonomous on-chain defense.
* **Live Links:**
  * **Live Web3 DApp:** `https://portal-sentinel-pi.vercel.app/`
  * **Live Pitch Deck:** `https://portal-sentinel-pi.vercel.app/pitch-deck.html`
  * **Live Demo Video:** `https://portal-sentinel-pi.vercel.app/demo.mp4`
