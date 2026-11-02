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

Run the full automated test suite containing 12 security and invariant tests:

```bash
cd contracts
forge test -v
```

### Test Results:
```text
Ran 12 tests for test/PortalSentinel.t.sol:PortalSentinelTest
[PASS] testFuzz_SweepNeverExceedsAllowanceOrBalance(uint96,uint96) (runs: 256)
[PASS] test_BatchRevokeRevertsOnEmptyBatch()
[PASS] test_BatchRevokeRevertsWhenTokenLacksGuardianHook()
[PASS] test_BatchRevokeStopsDrainer()
[PASS] test_EmergencySweepMovesFundsStrictlyToColdSafe()
[PASS] test_EmergencySweepRevertsWithoutApproval()
[PASS] test_GuardianCannotSweepToItself()
[PASS] test_NonGuardianCannotTriggerDefense()
[PASS] test_PausedRegistryBlocksDefenseAndEnrollment()
[PASS] test_RegisterAndActivateShield()
[PASS] test_SweepAccountingCountsOnlyMovedTokens()
[PASS] test_ValidationRulesForEmergencySafe()
Suite result: ok. 12 passed; 0 failed; 0 skipped
```

These are internal tests, not an external audit.

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

## 5. Synthetic Simulation Harness

Reads the live block height from Portaldot V3, then evaluates a **synthetic** threat
signal locally. It does not sign or broadcast a transaction:

```bash
cd daemon
TELEGRAM_ALERTS_ENABLED=false npm run simulate
```

### Verified Output:
```text
[1/5] Connected to Portaldot Testnet. Current Block: #295468   (height varies)
[2/5] Initialized Test Scenario:
      Victim Wallet:    0xB5774e9a6D233d0B0F859C237E204EE3A36C0E9C
      Hacker Address:   0x1eAB5D3B166Fc1F3721ab8804cE7B160930B1e77
      Cold Safe Target: 0x48D688128Ab80DF55955a44b08cd55987FF3444c

[3/5] Simulating Inbound Threat Signal:
      [EXEC] Event: AttackInitiated
      [ASSET] Draining Target: 5,000 pUSD
      [NOTE] Synthetic signal — no transaction was broadcast.

[4/5] Sentinel Threat Evaluation:
      Score:       100/100 [CRITICAL]
      Decision:    [ALERT] AUTO-DEFENSE WOULD TRIGGER
      Action:      TRIGGER_EMERGENCY_SWEEP
      Reasons:
        - Explicit attack/outflow signature detected from unverified spender
        - High token transfer outflow: 5000000000000000000000 base units
        - Spender lacks verified protocol registry certification

[5/5] Sending Telegram Advisories (if configured)...
[TELEGRAM] Alerts are disabled in config.

==================================================================
   [OK] Simulation complete. No on-chain transaction was broadcast.
   Telegram advisories: not sent (disabled or failed)
==================================================================
```

---

## 6. Security Invariants (Honest Disclosures)

1. **Non-Custodial Enforcement:** The Guardian bot can *never* transfer tokens to itself. Assets are exclusively swept to `userPolicy.emergencySafe`.
2. **Zero-Downside Revocation:** Zeroing allowances (`approve(spender, 0)`) carries no financial downside to the user; it only strips spending rights from external contracts.
