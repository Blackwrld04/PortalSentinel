# 🛡️ PortalSentinel — On-Chain Verification & Proofs

This document contains verifiable on-chain proofs, contract artifacts, and reproducible commands for judges of **Portaldot Hacker House 2026** on DoraHacks.

---

## 1. Network & Chain Information

| Parameter | Value |
| :--- | :--- |
| **Network Name** | Portaldot V3 Testnet |
| **Execution Layer** | `pallet-revive` (Dual-VM RISC-V + REVM) |
| **Chain ID (EVM)** | `420420777` (`0x190f1ca9`) |
| **EVM RPC Endpoint** | `https://test-evm-rpc-v3.portaldot.dev` |
| **Substrate Node URL** | `wss://test-node-v3.portaldot.dev` |
| **Block Explorer** | [https://node-console.portaldot.dev/](https://node-console.portaldot.dev/) |
| **Native Token** | POT (Testnet: tPOT) |

---

## 2. Smart Contract Deployments (Portaldot V3 EVM)

| Contract | Purpose | Compiler / Version | Status |
| :--- | :--- | :--- | :---: |
| **`SentinelRegistry.sol`** | User protection policies, sensitivity modes, and emergency safe store | Solc `0.8.24` (Cancun) | ✅ Tested & Ready |
| **`DefenseExecutor.sol`** | Non-custodial circuit breaker (`executeEmergencyBatchRevoke`, `executeEmergencySweep`) | Solc `0.8.24` (Cancun) | ✅ Tested & Ready |
| **`MockERC20.sol`** | Testnet token (`pUSD`) supporting direct guardian revocation | Solc `0.8.24` (Cancun) | ✅ Tested & Ready |
| **`MockExploitFixture.sol`** | Deterministic attack simulation fixture for instant judge verification | Solc `0.8.24` (Cancun) | ✅ Tested & Ready |

---

## 3. Local Test Suite Verification (Foundry)

Run the full automated test suite containing 6 security and invariant tests:

```bash
cd contracts
forge test -v
```

### Test Results:
```text
Ran 6 tests for test/PortalSentinel.t.sol:PortalSentinelTest
[PASS] test_BatchRevokeStopsDrainer() (gas: 349294)
[PASS] test_EmergencySweepMovesFundsStrictlyToColdSafe() (gas: 376105)
[PASS] test_NonGuardianCannotTriggerDefense() (gas: 159982)
[PASS] test_RegisterAndActivateShield() (gas: 141499)
[PASS] test_SimulateDefenseDirectForSandbox() (gas: 224956)
[PASS] test_ValidationRulesForEmergencySafe() (gas: 58088)
Suite result: ok. 6 passed; 0 failed; 0 skipped
```

---

## 4. Live RPC Query & Verification via Terminal

Verify the Portaldot V3 Testnet connection and block production directly using `curl`:

### Query Chain ID:
```bash
curl -s -X POST https://test-evm-rpc-v3.portaldot.dev \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# Expected Output: {"jsonrpc":"2.0","id":1,"result":"0x190f1ca9"} (420420777)
```

### Query Latest Block Number:
```bash
curl -s -X POST https://test-evm-rpc-v3.portaldot.dev \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## 5. Live Simulation Harness

Execute the automated end-to-end threat detection and evaluation test:

```bash
cd daemon
npm run simulate
```

### Verified Output:
```text
[1/4] Connected to Portaldot Testnet. Current Block: #257077
[2/4] Initialized Test Scenario:
      Victim Wallet:    0x6198fA0eC3d9E345bB5A429bC283F8C564619C74
      Hacker Address:   0xC965f54D0f312cb6E7947171d9a2636e7a2b9F49
      Cold Safe Target: 0x9378C531475Ffe51368f5a6e8790089eC8d9a27A

[3/4] Simulating Inbound Threat Signal:
      ⚡ Event: AttackInitiated
      💰 Draining Target: 5,000 pUSD

[4/4] Sentinel Threat Evaluation:
      Score:       100/100 [CRITICAL]
      Decision:    🚨 AUTO-DEFENSE TRIGGERED
      Action:      TRIGGER_EMERGENCY_SWEEP
      Reasons:
        - Explicit attack/outflow signature detected from unverified spender
        - High token transfer outflow: 5000000000000000000000 base units
        - Spender lacks verified protocol registry certification

   ✅ Simulation Complete! Logic & Scoring Verified.
```

---

## 6. Security Invariants (Honest Disclosures)

1. **Non-Custodial Enforcement:** The Guardian bot can *never* transfer tokens to itself. Assets are exclusively swept to `userPolicy.emergencySafe`.
2. **Zero-Downside Revocation:** Zeroing allowances (`approve(spender, 0)`) carries no financial downside to the user; it only strips spending rights from external contracts.
