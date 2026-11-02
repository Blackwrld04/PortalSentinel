# PortalSentinel

**Autonomous closed-loop security firewall and block-level circuit breaker for Portaldot V3 EVM (`pallet-revive` RISC-V PolkaVM) — detecting approval drains, dispatching a priority-gas defense, and delivering 24/7 mobile protection via Telegram.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network: Portaldot V3](https://img.shields.io/badge/Network-Portaldot%20V3%20(420420777)-purple.svg)](https://node-console.portaldot.dev/)
[![Foundry Tests](https://img.shields.io/badge/Foundry%20Tests-12%2F12%20Passing-brightgreen.svg)](contracts/)
[![Track: Node Operations & Tooling](https://img.shields.io/badge/DoraHacks-Track%203%20Tooling-orange.svg)](docs/DORAHACKS_SUBMISSION_KIT.md)
[![Substrate Engine](https://img.shields.io/badge/Engine-pallet--revive%20%2F%20PolkaVM-black.svg)](https://node-console.portaldot.dev/)

> **Production status:** this repository is being hardened from a hackathon demo into an
> operator-grade service. See
> [`docs/PRODUCTION_HARDENING_PLAN.md`](docs/PRODUCTION_HARDENING_PLAN.md) for the
> P0/P1/P2 roadmap and the exact remaining gaps.
>
> **Detection scope today:** the daemon watches the demo `MockExploitFixture`
> `AttackInitiated` event over a block poll. That event is emitted *inside the drain
> transaction*, so by the time the daemon sees it the triggering transfer has already
> mined. The defense protects the **remaining allowance and balance** by revoking the
> approval and (when the executor is approved) sweeping the remaining tokens to the
> user's cold safe. It does not undo the transfer that emitted the signal, and it is not
> yet a general-purpose mempool detector. Live transaction inspection, spender
> reputation, and observe-only rollout are P1.

---

## Table of Contents

1. [What Is PortalSentinel?](#1-what-is-portalsentinel)
2. [Track 3: Node Operations & Tooling — How This Fits](#2-track-3-node-operations--tooling--how-this-fits)
3. [Why Portaldot V3 (`pallet-revive`) — And Why Low Latency Matters](#3-why-portaldot-v3-pallet-revive--and-why-low-latency-matters)
4. [The Dual-Defense Architecture (Solving the Standard ERC-20 Flaw)](#4-the-dual-defense-architecture-solving-the-standard-erc-20-flaw)
5. [24/7 Mobile Shield — Telegram Bot Autopilot](#5-247-mobile-shield--telegram-bot-autopilot)
6. [Living Sentinel Guardian Robot & Cyberpunk Dashboard](#6-living-sentinel-guardian-robot--cyberpunk-dashboard)
7. [Node Operator CLI Tooling Suite](#7-node-operator-cli-tooling-suite)
8. [Dockerization for Colocated Validator Nodes](#8-dockerization-for-colocated-validator-nodes)
9. [Repository Structure](#9-repository-structure)
10. [Running the Project (Quickstart)](#10-running-the-project-quickstart)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Smart Contract Reference](#12-smart-contract-reference)
13. [Hard-Won Engineering Lessons on Portaldot V3 EVM & Substrate](#13-hard-won-engineering-lessons-on-portaldot-v3-evm--substrate)
14. [Comparative Analysis: PortalSentinel vs. ApprovalGuardian](#14-comparative-analysis-portalsentinel-vs-approvalguardian)
15. [DoraHacks Hackathon Submission Details](#15-dorahacks-hackathon-submission-details)

---

## 1. What Is PortalSentinel?

When users interact with decentralized applications, DEX routers, bridges, and lending vaults, they routinely grant **unlimited token allowances** (`type(uint256).max`). When a protocol router is compromised by a zero-day exploit, malicious upgrade, or private key leak, attackers exploit these pre-existing allowances via `transferFrom` calls to drain millions of dollars in capital in seconds.

Existing security tools are **passive and forensic** — they alert users minutes or hours after funds have already been extracted. Oracle consensus solutions (such as Chainlink CRE) take **15 to 45 seconds** to reach Byzantine Fault Tolerant consensus across nodes, which is fatal when an attack transaction executes within the very next block.

**PortalSentinel** eliminates the human latency bottleneck with an **autonomous closed-loop firewall**:

1. **Sub-Second Threat Detection:** The Sentinel Daemon polls inbound blocks from Portaldot V3 EVM (`pallet-revive`), decodes attack events, and evaluates them against a heuristic anomaly scoring matrix in **<1ms**.
2. **Priority Fee Escalation:** When a threat crosses the user's threshold, the daemon dispatches a counter-transaction with a **1.35× fee multiplier** (rising to 1.60× and 1.85× on retries). Higher fees improve inclusion odds but do **not** guarantee ordering ahead of an attacker; the daemon reports what actually happened on-chain.
3. **Universal Dual-Defense (Solving the ERC-20 Flaw):** Standard ERC-20 tokens do not support third-party revocation. PortalSentinel executes an atomic batch revocation where the token supports a guardian hook, and an **Emergency Capital Sweep** (`executeEmergencySweep`) that transfers the victim's remaining token balance into their pre-registered cold vault (`emergencySafe`). A sweep is chosen only when the victim has approved the executor; after a sweep the daemon also attempts to zero the attacker's residual allowance.
4. **Zero-Custody Guarantee:** By smart contract invariant, the Sentinel Guardian operator can **never** divert funds to itself. Capital can strictly and only be transferred to the user's immutable emergency safe.
5. **24/7 Background Autopilot (Telegram Bot):** Users enroll once and walk away. The daemon runs continuously; when a defense is dispatched, a Telegram advisory is sent with the real transaction hash (or an explicit dry-run/failure notice).

---

## 2. Track 3: Node Operations & Tooling — How This Fits

PortalSentinel was built specifically for **DoraHacks Portaldot Hacker House 2026 (Track 3: Node Operations & Tooling)**:

| Hackathon Requirement | How PortalSentinel Delivers |
|---|---|
| **Node Monitoring & RPC Telemetry** | Built-in CLI command `npm run cli health` probes Portaldot V3 EVM latency, Substrate node status, latest block height, and gas pricing in real time. |
| **Network Security Analysis** | Built-in CLI command `npm run cli audit <address>` audits live on-chain allowances, flags suspicious unverified spenders, and computes risk scores. |
| **Automated Staking / Defense Execution** | Closed-loop `DefenseDispatcher` automates gas priority escalation and autonomous execution on `DefenseExecutor.sol`. |
| **Colocated Node Tooling** | Packaged with `Dockerfile` and `docker-compose.yml` for node runners to deploy the Sentinel daemon alongside their Portaldot V3 full node. |

---

## 3. Why Portaldot V3 (`pallet-revive`) — And Why Low Latency Matters

PortalSentinel is not a generic EVM script ported to Portaldot. It was engineered specifically to exploit the architectural capabilities of **Portaldot Network V3.0 (`pallet-revive` on Substrate RISC-V PolkaVM)**:

### 3.1 Sub-Second Block Times (~1000ms)
Traditional Layer 1 blockchains (such as Ethereum with 12-second slots) suffer from unpredictable transaction ordering and heavy MEV searcher competition. Portaldot V3's sub-second block times let a colocated daemon evaluate a signal and broadcast a defense transaction for inclusion in the next block tick. Actual preemption depends on block timing, RPC behavior, and gas priority; the measured figure in the demo is dispatch latency, not a guaranteed front-run.

### 3.2 RISC-V PolkaVM Bytecode Execution
`pallet-revive` executes smart contracts via PolkaVM (a general-purpose RISC-V virtual machine) with REVM integration. This provides predictable execution cycles and negligible interpretation overhead, allowing complex batch revocations and multi-token sweeps to execute without hitting block gas limits.

### 3.3 Native `POT` Priority Escalation
All transactions on Portaldot V3 utilize native `POT` tokens for gas. The Sentinel Daemon calculates dynamic EIP-1559 priority fee escalation directly in `POT`, ensuring block builders prioritize the circuit breaker transaction ahead of the attacker.

### 3.4 Dual-Identity Substrate & EVM Architecture
Portaldot bridges native Substrate SS58 addresses (beginning with `5`, such as `5FKcVpYCBtCCaeGP6ZDTdhKGgbNibGLoEbFTGJzkZodXh6jV`) with EVM H160 addresses (`0x4d5a5FC178916ED51Ec0a02E38028f47AC2f6E67`). PortalSentinel natively supports this dual identity across the dashboard, telemetry feed, and token faucet coordination.

---

## 4. The Dual-Defense Architecture (Solving the Standard ERC-20 Flaw)

### The Fatal Flaw of Existing Revocation Protocols
Prior hackathon projects and theoretical revokers rely on calling custom interfaces like:
```solidity
// SILENTLY FAILS on standard ERC-20s!
try IGuardianRevocable(token).guardianRevokeApproval(user, spender) {
    // Revoked
} catch {
    // Silent catch — attacker drains wallet anyway!
}
```
Standard ERC-20 tokens (such as USDC, USDT, DAI, WETH, or native Portaldot wrapped tokens) **do not implement `guardianRevokeApproval`**. When an attacker attacks a wallet holding standard ERC-20s, conventional guardian contracts silently fail.

### The PortalSentinel Universal Solution
PortalSentinel implements a **Dual-Defense Model**:

```
                       Inbound Threat Detected
                                  │
                                  ▼
                    Threat Score >= 60 Confirmed
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
   [executeEmergencyBatchRevoke]       [executeEmergencySweep]
   Used when spender allowance can     Used when token is standard ERC-20
   be zeroed on-chain.                 or under active drain.
                 │                                 │
                 ▼                                 ▼
         Allowance = 0                    Token Balance Moved Atomically
    Attacker Call Reverts                 to User's Immutable Cold Safe!
```

1. **`executeEmergencyBatchRevoke`**: Zeroes allowances across multiple tokens and spenders in a single atomic transaction, and verifies each allowance actually reached zero before reporting success.
2. **`executeEmergencySweep`**: When the allowance cannot be modified by a third party, the contract sweeps the user's remaining token balance directly into their pre-registered `emergencySafe`. This protects funds still in the wallet; it cannot reverse a transfer that already mined.

### Zero-Custody Contract Invariant
In `DefenseExecutor.sol`:
```solidity
function executeEmergencySweep(address user, address[] calldata tokens, uint256 threatScore) external onlyAuthorizedGuardian {
    address coldSafe = registry.getEmergencySafe(user);
    require(coldSafe != address(0), "DefenseExecutor: No emergency safe configured");
    require(coldSafe != msg.sender, "DefenseExecutor: Zero-custody invariant violated");

    for (uint256 i = 0; i < tokens.length; i++) {
        uint256 balance = IERC20(tokens[i]).balanceOf(user);
        if (balance > 0) {
            // Strictly transfers to user's cold safe — NEVER to guardian operator!
            IERC20(tokens[i]).transferFrom(user, coldSafe, balance);
        }
    }
}
```

---

## 5. 24/7 Mobile Shield — Telegram Bot Autopilot

### Do Users Need to Keep the Website Open?
**NO!** Users register their wallet and configure their sensitivity threshold once. The daemon runs 24/7 on a host the operator controls. When the configured detection signal fires, it attempts an on-chain defense and sends a Telegram advisory. In the current P0 detection scope the signal comes from the demo fixture after its drain transaction has mined, so the defense protects the *remaining* allowance and balance rather than reversing that first transfer.

### Interactive 2-Way Bot Commands (`@PortalSentinelAlertsBot`)
Node operators and users can interact with the Telegram service (`npm run telegram:bot`):
* `/start` — Welcome advisory, automatic Chat ID extraction, and wallet binding instructions.
* `/status` — Current Portaldot V3 EVM block height and gas price from the configured RPC.
* `/audit <0xAddress>` — Reports native balance, account type, and whether the registry marks the address as protected. Allowance-level detail is available through `npm run cli audit`.
* `/help` — Lists command manual.

### Push Notification Structure
When a defense is dispatched, the user receives an alert with:
* Threat Severity Badge (`[CRITICAL THREAT]`)
* Defense latency from broadcast to confirmation (labelled as such; not a "front-run" guarantee)
* Amount moved to the cold safe when a sweep actually ran
* Confirmed block number and transaction hash for live defenses, or an explicit dry-run/failure notice
* Direct Clickable Link to [Portaldot Node Console Explorer](https://node-console.portaldot.dev/)

**Secret handling:** `TELEGRAM_BOT_TOKEN` belongs only in `daemon/.env` (or the daemon's secret
store). The dashboard has no bot token and does not call the Telegram API. If a token has ever
been committed or shipped in a frontend bundle, revoke it with `@BotFather` and issue a new one.

---

## 6. Living Sentinel Guardian Robot & Cyberpunk Dashboard

The frontend command center (`http://localhost:3002`) provides a state-of-the-art interactive experience:

* **Living Cybernetic Guardian Bot (`SentinelGuardian.tsx`):**
  * Features blinking neon digital eyes that autonomously scan incoming blocks and smoothly track the user's cursor.
  * Counter-rotating telemetry rings and dynamic floating physics with live status halos.
* **Live Web3 Wallet Connection (Pillar 2):**
  * One-click MetaMask / Rabby wallet connection.
  * Automatic network detection and switching to **Portaldot V3 Testnet (`420420777`)**.
  * Real-time native `POT` gas balance display and Substrate SS58 identity linking.
* **Interactive Exploit & Defense Walkthrough:**
  * Step through a local UI simulation of a drain response on Portaldot V3 EVM. It does not sign or broadcast.
  * Visual 5-phase timeline tracking Exploit Trigger $\rightarrow$ Threat Scoring $\rightarrow$ 1.35x Fee Escalation $\rightarrow$ Atomic Revocation $\rightarrow$ Remaining Funds Swept to Safe.
* **Telegram Alert Preview:**
  * Illustrative mockup of the alert format. Messages are sent by the daemon, not the browser.

---

## 7. Node Operator CLI Tooling Suite

PortalSentinel includes a purpose-built CLI tool (`sentinel`) located in `daemon/`:

```bash
cd daemon

# 1. Probe Portaldot V3 EVM & Substrate node health, RPC latency, gas price
npm run cli health

# 2. Audit an address or contract for dangerous allowances & risk scores
npm run cli audit 0x4d5a5FC178916ED51Ec0a02E38028f47AC2f6E67

# 3. Benchmark RPC latency across consecutive requests
npm run cli benchmark

# 4. View heuristic threat scoring rules & sensitivity thresholds
npm run cli matrix

# 5. Verify 24/7 Telegram notification dispatch
npm run cli telegram:test <your-chat-id>
```

---

## 8. Dockerization for Colocated Validator Nodes

Run PortalSentinel as a containerized background service colocated with your Portaldot V3 node:

```bash
# Build and launch containerized daemon in background
docker compose up -d

# Stream real-time logs
docker compose logs -f

# Check container health status
docker ps --filter "name=portal-sentinel-daemon"
```

The daemon runs as a non-root `sentinel` user and persists its last-processed-block
journal in the named volume `sentinel-data` mounted at `/data`, so restarts resume from
the last scanned block instead of replaying (or skipping) history. Override
`GUARDIAN_PRIVATE_KEY` and `DRY_RUN=false` through the environment or a local `.env`
when you are ready to broadcast; the compose defaults stay in dry-run.

On a live start the daemon refuses to run if `DefenseExecutor.registry()` does not match
`SENTINEL_REGISTRY_ADDRESS`, if the registry is paused, or if the guardian key is not an
authorized guardian. That check converts the most common deployment mistake into a
startup error rather than a silent string of reverted defenses.

---

## 9. Repository Structure

```
PortalSentinel/
├── contracts/                     # Solidity 0.8.24 Smart Contracts & Foundry
│   ├── src/
│   │   ├── SentinelRegistry.sol   # User policy & emergency cold safe store
│   │   ├── DefenseExecutor.sol    # Atomic batch revoke & emergency sweep
│   │   ├── MockERC20.sol          # Portaldot USD (pUSD) test asset fixture
│   │   └── MockExploitFixture.sol # Reproducible attack testbed
│   ├── script/
│   │   └── DeployPortalSentinel.s.sol # Testnet deployment script
│   └── test/
│       └── PortalSentinel.t.sol   # 12/12 Passing Foundry test suite
│
├── daemon/                        # Closed-Loop Threat Engine & Node CLI
│   ├── src/
│   │   ├── index.ts               # Autonomous daemon entrypoint
│   │   ├── listener.ts            # Band-scoped block scanner with persisted journal
│   │   ├── threatScorer.ts        # Heuristic anomaly scoring matrix
│   │   ├── defensePlan.ts         # Pure action-selection/viability logic
│   │   ├── dispatcher.ts          # Fee-escalating defense dispatcher (retries, nonce mgmt)
│   │   ├── state.ts               # Atomic block-journal persistence
│   │   ├── telegramNotifier.ts    # 24/7 Mobile push alert service
│   │   ├── telegramBot.ts         # Interactive 2-way Telegram bot listener
│   │   ├── cli.ts                 # Node operator CLI tooling suite
│   │   └── simulateAttack.ts      # Live attack simulation harness
│   └── package.json
│
├── frontend/                      # Command Center & Telemetry UI
│   ├── src/
│   │   ├── App.tsx                # Main dashboard & live Web3 integration
│   │   ├── SentinelGuardian.tsx   # Living robot with eye tracking physics
│   │   └── index.css              # Cyberpunk visual styling
│   └── package.json
│
├── docs/                          # Comprehensive Documentation Package
│   ├── DORAHACKS_SUBMISSION_KIT.md# Official DoraHacks submission document
│   ├── PITCH_DECK.md              # 9-slide pitch deck structure
│   ├── COMPARATIVE_ANALYSIS.md    # Technical analysis vs. ApprovalGuardian
│   └── PROOF.md                   # Verifiable testnet execution logs
│
├── Dockerfile                     # Multi-stage production container
├── docker-compose.yml             # Validator-colocated deployment spec
├── package.json                   # Root workspace orchestration
└── README.md                      # Primary project reference
```

---

## 10. Running the Project (Quickstart)

### Prerequisites
* Node.js v20+
* Foundry (`forge`, `cast`)
* MetaMask / Web3 Wallet

### 0. Configure safely
```bash
cp daemon/.env.example daemon/.env
# Keep DRY_RUN=true until you have deployed contracts and a dedicated guardian key.
# A missing GUARDIAN_PRIVATE_KEY is fine in dry-run mode; it is required to broadcast.
```

### 1. Install Dependencies & Build
```bash
# Install root, daemon, and frontend dependencies
npm run build
```

### 2. Run Smart Contract & Daemon Tests
```bash
# Foundry: 12 tests, including fuzz coverage of the sweep invariant
npm run test

# Daemon: scorer + state-journal unit tests
npm run test:unit
```
*Result: 12/12 Foundry tests and 15/15 daemon tests pass.*

### 3. Run Node Operator Health Probe
```bash
npm run cli:health
```

### 4. Run Live Attack Simulation Harness
```bash
npm run test:daemon
```

### 5. Launch Frontend Dashboard
```bash
npm run dev
# Open http://localhost:3002 in your browser
```

---

## 11. Environment Variables Reference

### `daemon/.env`

| Variable | Description | Default / Example |
|---|---|---|
| `PORTALDOT_RPC_URL` | Portaldot V3 EVM JSON-RPC endpoint | `https://test-evm-rpc-v3.portaldot.dev` |
| `PORTALDOT_RPC_URLS` | Optional comma-separated failover endpoints | *(unset)* |
| `PORTALDOT_CHAIN_ID` | EVM Chain ID | `420420777` |
| `PORTALDOT_REQUEST_TIMEOUT_MS` | Per-request RPC timeout | `10000` |
| `PORTALDOT_LOG_RANGE_BLOCKS` | Blocks per `getLogs` batch during catch-up | `500` |
| `SENTINEL_REGISTRY_ADDRESS` | Deployed SentinelRegistry contract | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `DEFENSE_EXECUTOR_ADDRESS` | Deployed DefenseExecutor contract | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| `MOCK_TOKEN_ADDRESS` | Token watched by the demo fixture | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| `MOCK_EXPLOIT_ADDRESS` | Demo attack fixture / log emitter | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |
| `GUARDIAN_PRIVATE_KEY` | Operator key for defense dispatch. **Required only when `DRY_RUN=false`.** | *(no default)* |
| `DRY_RUN` | Simulate defense decisions without broadcasting | `true` |
| `DEFENSE_MAX_ATTEMPTS` | Pre-broadcast retry attempts | `3` |
| `DEFENSE_RECEIPT_TIMEOUT_MS` | Receipt wait before reporting a pending tx | `60000` |
| `STATE_FILE` | Persisted last-processed-block journal | `.sentinel-state.json` (`/data/...` in Docker) |
| `TELEGRAM_BOT_TOKEN` | Bot API token from `@BotFather` | `123456789:ABCdef...` |
| `TELEGRAM_CHAT_ID` | Default Telegram chat ID for alerts | `123456789` |
| `TELEGRAM_ALERTS_ENABLED` | Toggle 24/7 Telegram dispatch | `true` |
| `METRICS_HOST` / `METRICS_PORT` | Health/Prometheus bind address | `127.0.0.1` / `3001` |
| `CORS_ORIGIN` | Allowed dashboard origin for metrics CORS | `http://localhost:3002` |

---

## 12. Smart Contract Reference

### Portaldot V3 EVM Testnet

* **EVM RPC:** `https://test-evm-rpc-v3.portaldot.dev`
* **Node Explorer:** [https://node-console.portaldot.dev/](https://node-console.portaldot.dev/)
* **Chain ID:** `420420777` (`0x190f1ca9`)
* **Gas Currency:** `POT`

### Core Interfaces & ABIs

#### `SentinelRegistry.sol`
```solidity
enum DefenseMode { CONSERVATIVE, BALANCED, AGGRESSIVE }

function registerShield(DefenseMode _mode, address _emergencySafe) external;
function updateEmergencySafe(address _newSafe) external;
function updateDefenseMode(DefenseMode _newMode) external;
function deactivateShield() external;
function isProtected(address _user) external view returns (bool);
function getUserPolicy(address _user) external view returns (UserPolicy memory);
function getEmergencySafe(address _user) external view returns (address);
```

#### `DefenseExecutor.sol`
```solidity
function executeEmergencyBatchRevoke(
    address user, 
    address[] calldata tokens, 
    address[] calldata spenders,
    uint256 threatScore
) external onlyAuthorizedGuardian;

function executeEmergencySweep(
    address user, 
    address[] calldata tokens,
    uint256 threatScore
) external onlyAuthorizedGuardian;
```

---

## 13. Hard-Won Engineering Lessons on Portaldot V3 EVM & Substrate

During the development and testing of PortalSentinel on Portaldot V3 (`pallet-revive`), our team documented several critical technical findings:

1. **IPv6 vs. IPv4 RPC Timeouts:** The public endpoint `https://test-evm-rpc-v3.portaldot.dev` is dual-stack, and IPv6 routes can be unreachable. Combining `dns.setDefaultResultOrder("ipv4first")` with Node's `--no-network-family-autoselection` flag prevents Happy Eyeballs from stalling on the dead route; the daemon scripts and container set both.
2. **Standard ERC-20 Revocation Impossibility:** Traditional guardian contracts fail because third-party smart contracts cannot call `token.approve(spender, 0)` on behalf of a victim. Implementing `executeEmergencySweep` to transfer balances to an invariant cold vault is the only universal defense that protects standard tokens.
3. **Substrate SS58 vs. EVM H160 Mapping:** The testnet token faucet requires an SS58 address starting with `5`, while MetaMask and Foundry contracts require an H160 address starting with `0x`. Exposing both identities side-by-side in the UI eliminates onboarding friction.
4. **Autonomous Autopilot Requirement:** Users will not keep a browser tab open 24/7. Connecting the daemon to Telegram via long-polling and instant push dispatch transforms a local tool into a hands-free security guardian.

---

## 14. Comparative Analysis: PortalSentinel vs. ApprovalGuardian

A detailed technical comparison document is available at [`docs/COMPARATIVE_ANALYSIS.md`](docs/COMPARATIVE_ANALYSIS.md):

| Dimension | ApprovalGuardian (Reference Hackathon Project) | PortalSentinel (Our Project) |
| :--- | :--- | :--- |
| **Response Latency** | **15 – 45 seconds** (Multi-block DON BFT consensus) | **Block-scanner detection + 1.35× gas priority** (dispatch latency measured in the demo) |
| **Standard ERC-20 Tokens** | **Fails silently** (requires non-standard `guardianRevokeApproval`) | **100% Universal** via Dual Defense (Revocation + Emergency Sweep) |
| **Target Infrastructure** | Ethereum Sepolia, Arbitrum (Standard EVM) | **Portaldot V3 EVM (`pallet-revive` on Substrate RISC-V PolkaVM)** |
| **User Independence** | Script-tied, relies on Supabase and dashboard polling | **True 24/7 Autopilot**: Cloud daemon runs non-stop; pushes to Telegram |
| **Node Operations Tooling**| None | **Full Track 3 CLI Suite**: `node-health`, `audit`, `matrix`, `benchmark`, `telegram:test` |
| **Visual Identity & UX** | Standard dashboard forms | **Living Guardian Bot** (eye tracking physics) + Live Exploit Sandbox + Mobile Simulator |

---

## 15. DoraHacks Hackathon Submission Details

* **Submission Kit:** [`docs/DORAHACKS_SUBMISSION_KIT.md`](docs/DORAHACKS_SUBMISSION_KIT.md)
* **Pitch Deck:** [`docs/PITCH_DECK.md`](docs/PITCH_DECK.md)
* **Demo Video Storyboard:** Included in `docs/DORAHACKS_SUBMISSION_KIT.md` (3-minute runtime)
* **Official Discord Contact:** DM admin `@titus242471` on Portaldot Discord / `@Stella707827` on DoraHacks
* **Team:** PortalSentinel Core Team

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details. Built with pride for the **Portaldot Network Ecosystem Foundation Hacker House 2026**.
