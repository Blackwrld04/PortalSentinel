# Comprehensive Comparative Analysis: PortalSentinel vs. ApprovalGuardian

> **Note (production hardening):** this is the original October 2026 hackathon narrative.
> See [`PRODUCTION_HARDENING_PLAN.md`](./PRODUCTION_HARDENING_PLAN.md) for current
> capabilities and remaining gaps. Latency, mempool, and front-running figures below are
> design targets from that narrative, not measurements of the P0 build.

This technical analysis provides an in-depth architectural and operational comparison between **PortalSentinel** (built for Portaldot V3 EVM & Substrate, Track 3 Node Operations & Tooling) and the reference project **ApprovalGuardian** (built for the Chainlink Convergence Hackathon).

---

## 1. Executive Summary & Core Philosophy

| Dimension | ApprovalGuardian (Reference Project) | PortalSentinel |
| :--- | :--- | :--- |
| **Primary Goal** | Post-incident / slow-cadence approval revocation via off-chain oracle consensus | Preemptive, sub-second mempool front-running firewall and autonomous circuit breaker |
| **Target Runtime** | Ethereum Sepolia, Arbitrum, Base (Standard EVM) | Portaldot V3 EVM (`pallet-revive` on Substrate RISC-V PolkaVM) |
| **Execution Model** | Chainlink Runtime Environment (CRE) WASM decentralized workflows | High-frequency node daemon with direct block & mempool socket streaming |
| **Detection Speed** | **15 – 45+ seconds** (multi-block consensus, SSE/cron polling) | **< 15 milliseconds** (local/validator mempool stream + 1.35x gas priority) |
| **ERC-20 Compatibility** | **Fails on standard ERC-20s** (requires non-standard `guardianRevokeApproval`) | **100% Universal**: Dual defense (`executeEmergencyBatchRevoke` + `executeEmergencySweep`) |
| **User Dependency** | Semi-autonomous; relies on Supabase backend and periodic polling | **True Autopilot (24/7)**: Set-and-forget; Telegram alerts push directly to phone without keeping site open |
| **Node Tooling** | None (focused on smart contracts & WASM workflows) | **Full Track 3 CLI Suite** (`node-health`, `audit`, `matrix`, `benchmark`, `telegram:test`) |

---

## 2. Architectural Comparison

```
┌───────────────────────────────────────────────────────────────────────────┐
│               APPROVALGUARDIAN (REFERENCE ARCHITECTURE)                   │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  [Cron / HTTP] ──► [Workflow 1: Scanner]                                  │
│                          │                                                │
│                          ▼ (Logs to Supabase)                             │
│                    [Supabase DB]                                          │
│                          ▲                                                │
│                          │                                                │
│  [DeFiLlama API] ──► [Workflow 2: Threat Monitor]                         │
│                          │  (Chainlink DON BFT Consensus: 15–30s)         │
│                          ▼                                                │
│                    [Workflow 3: Executor]                                 │
│                          │                                                │
│                          ▼ (Signed Report via CRE Forwarder)              │
│                [ApprovalGuardian.sol]                                     │
│                          │ (Calls custom token hook)                      │
│                          ▼                                                │
│              [MockProtocolToken.sol] (Fails if standard ERC-20)           │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                    PORTALSENTINEL ARCHITECTURE                            │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  [Portaldot V3 Mempool] ──► [BlockStreamListener (Sub-second socket)]     │
│                                      │                                    │
│                                      ▼ (<1ms)                             │
│                           [ThreatScorer Engine]                           │
│                           (Heuristic Anomaly Matrix)                      │
│                                      │                                    │
│                     ┌────────────────┴────────────────┐                   │
│                     ▼                                 ▼                   │
│          [TelegramNotifier]              [DefenseDispatcher]              │
│       (24/7 Push to Mobile Phone)         (1.35x Gas Priority)            │
│       - Zero site visit required                      │                   │
│       - Interactive explorer links                    ▼ (<15ms)           │
│                                           [DefenseExecutor.sol]           │
│                                            (pallet-revive PolkaVM)        │
│                                                       │                   │
│                                ┌──────────────────────┴──────────────┐    │
│                                ▼                                     ▼    │
│                     [Batch Revocation]                   [Emergency Sweep]│
│                     (Zeroes Allowances)                  (Protects ERC20) │
│                                                                      │    │
│                                                                      ▼    │
│                                                            [Cold Safe Vault]
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Technical Breakdown

### A. Preemption & Latency (The Mempool Front-Running Dilemma)
- **ApprovalGuardian**:
  - Operates as a Chainlink Runtime Environment (CRE) workflow compiled to WebAssembly (WASM).
  - To trigger defense, Workflow 2 polls DefiLlama or waits for an event log, submits the observation to a Decentralized Oracle Network (DON), achieves Byzantine Fault Tolerant (BFT) consensus (`consensusMedianAggregation` / `consensusIdenticalAggregation`), and sends an HTTP POST request to Workflow 3.
  - **Latency**: Typically **15,000ms to 45,000ms**. In a real-world flash loan or mempool front-running attack, the victim's wallet is drained in the **exact same block** the attack tx is mined. A 30-second oracle consensus will arrive after the victim's funds are already stolen.
- **PortalSentinel**:
  - Employs a continuous socket stream listener (`BlockStreamListener`) directly hooked into Portaldot V3 EVM (`pallet-revive`).
  - Portaldot features ~1000ms block times.
  - When an inbound transaction attempts an unauthorized `transferFrom`, the daemon identifies the threat signature in under **1 millisecond** and immediately broadcasts a counter-transaction with a **1.35x gas priority fee multiplier**.
  - **Result**: The defense transaction is mined **before** the attacker's transaction can execute, neutralizing the exploit atomically on-chain.

---

### B. Asset Protection & The Standard ERC-20 Flaw
- **ApprovalGuardian's Critical Limitation**:
  - In `ApprovalGuardian.sol`, revocation is implemented as:
    ```solidity
    try IGuardianRevocable(token).guardianRevokeApproval(wallet, spender) {
        emit ApprovalRevoked(wallet, spender, token, threatScore);
    } catch {
        // Silently fails!
    }
    ```
  - Standard ERC-20 tokens (such as USDC, USDT, DAI, WETH, or native Portaldot wrapped tokens) **do not have a `guardianRevokeApproval` method**.
  - Therefore, against any real-world ERC-20 token, ApprovalGuardian's revocation **silently catches and fails completely**.
- **PortalSentinel's Universal Dual-Defense**:
  - PortalSentinel introduces two complementary defense mechanisms:
    1. **`executeEmergencyBatchRevoke`**: Revokes approvals where permitted.
    2. **`executeEmergencySweep`**: When a token cannot be revoked or is actively being drained, the contract atomically transfers the user's token balance directly into their pre-registered cold vault (`emergencySafe`).
  - **Result**: Even if a standard ERC-20 cannot have its allowance modified by an external contract, the victim's capital is swept out of harm's way before the attacker's drain can extract it!

---

### C. User Experience: Autopilot vs. Continuous Monitoring
- **The Question**: *"Did the user have to come to the site every time or does the Telegram bot give notifications all the time?"*
- **ApprovalGuardian**:
  - Requires the user to register in a frontend connected to Supabase.
  - Workflows send a basic Telegram message during simulated runs, but the system is tightly tied to the Next.js UI running simulations.
- **PortalSentinel**:
  - **True 24/7 Autopilot**: The user registers their wallet and links their Telegram Chat ID once.
  - The PortalSentinel daemon operates 24/7 in the cloud/validator infrastructure.
  - The user **never has to visit or keep the website open**.
  - Whenever any suspicious transaction or exploit is intercepted, the Telegram bot immediately buzzes their phone with:
    - Threat risk score and breakdown
    - Preemption latency (e.g. `14 ms`)
    - On-chain transaction hash and link to Portaldot Node Console
    - Direct action buttons

---

### D. Ecosystem Alignment & Track 3 Tooling
- **ApprovalGuardian**: Built for Chainlink Convergence with standard EVM testnets (Sepolia).
- **PortalSentinel**: Purpose-built for **Portaldot V3 Testnet** (`pallet-revive` Substrate RISC-V PolkaVM, Chain ID 420420777).
- PortalSentinel directly addresses **Track 3 (Node Operations & Tooling)** by providing:
  - `npm run cli health`: Telemetry check for Portaldot EVM & Substrate node block height, gas prices, and latency.
  - `npm run cli audit <address>`: Allowance risk scanner inspecting live on-chain permissions.
  - `npm run cli matrix`: Live threat evaluation rules inspector.
  - `npm run cli benchmark`: Multi-request RPC latency probe.
  - `npm run cli telegram:test`: Real-time mobile push verification.

---

## 4. Side-by-Side Comparison Scorecard

| Capability | ApprovalGuardian (Reference) | PortalSentinel | Advantage |
| :--- | :---: | :---: | :--- |
| **Response Latency** | 15 – 45 sec | **10 – 15 ms** | **PortalSentinel (1000x faster)** |
| **Mempool Front-Running** | ❌ No (Oracle based) | **✅ Yes (1.35x Gas Priority)** | **PortalSentinel** |
| **Standard ERC-20 Support** | ❌ Fails silently | **✅ Yes (Emergency Sweep)** | **PortalSentinel** |
| **Substrate / PolkaVM Native** | ❌ No | **✅ Yes (pallet-revive)** | **PortalSentinel** |
| **24/7 Phone Push Alerts** | ⚠️ Script-tied | **✅ Background Autopilot** | **PortalSentinel** |
| **Interactive Guardian Bot** | ❌ None | **✅ Live Eye-Tracking & Physics**| **PortalSentinel** |
| **Node Operator CLI Suite** | ❌ None | **✅ Complete Track 3 Suite** | **PortalSentinel** |
| **Zero-Custody Guarantee** | ✅ Yes | **✅ Yes** | **Tied** |
| **BFT Oracle Consensus** | ✅ Yes (CRE DON) | ❌ Single Validator/Operator | **ApprovalGuardian** |

---

## 5. Conclusion

While **ApprovalGuardian** proved the theoretical concept of oracle-orchestrated approval revocation using Chainlink CRE on Sepolia, its high latency (15–45 seconds) and inability to protect standard ERC-20 tokens rendered it vulnerable to real-world zero-day exploits.

**PortalSentinel** evolves this paradigm into a production-grade, closed-loop security engine tailored specifically for **Portaldot V3 EVM**:
1. It eliminates the oracle latency bottleneck by operating as a direct mempool listener with 1.35x priority front-running.
2. It solves the ERC-20 limitation with autonomous `executeEmergencySweep` to cold safe vaults.
3. It liberates users from keeping browser tabs open through 24/7 background Telegram mobile push notifications.
4. It equips node runners with a comprehensive CLI telemetry and inspection suite.
