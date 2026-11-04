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

* **Deployer & Guardian EOA:** `0xD6047E51f4c52a28eA1fDDa94A60974e38C919A9`
* **Substrate Funder (`SS58`):** `5EF5e8yASsVqweYRo13nMXxgkxCC8mYPNarcRqY7a8S7Pyni`

| Contract | Deployed Address | Deployment Tx Hash | Block | Status |
| :--- | :--- | :--- | :---: | :---: |
| **`SentinelRegistry.sol`** | `0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF` | `0xcf77198f0b1666c4084441d61db60a39f6a07981a9c9605fb4341689ba48336c` | `#311022` | ✅ Live on Testnet |
| **`DefenseExecutor.sol`** | `0x89c9510c4b3AeEE8792De383D251ef0b61d406E2` | `0x4cdd30974731623f7e9b2e25768d328669a4207ac5d0b7ea8aa0135ae31220f0` | `#311067` | ✅ Live on Testnet |
| **`MockERC20.sol` (`pUSD`)** | `0x25da2DeD5b0Da07C160e021e0Df636988C3657f5` | `0xf959f9ea03878c9ff0472ee3343f0c50c2be0a8fc119a41d6b83de2c250b515b` | `#311161` | ✅ Live on Testnet |
| **`MockExploitFixture.sol`** | `0xc44a87FE907E497E50ffF6913c0b863bd0758a90` | `0xcfdbdcf2d2807b19a5b8b00a5e4c0b7ee69cffd8e9df89be1c4e596a9fe1b941` | `#310782` | ✅ Live on Testnet |
| **Registry `setDefenseExecutor`** | `0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF` | `0x9298f248fb8b53534ca7ae243331e162848ccbb36edbc66b4fba2971a181a0b4` | `#311068` | ✅ Linked |

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
