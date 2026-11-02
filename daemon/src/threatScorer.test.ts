import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFENSE_THRESHOLDS,
  RULE_WEIGHTS,
  ThreatScorer,
  thresholdForMode,
  modeName,
  type ThreatSignal,
} from "./threatScorer.js";

function signal(overrides: Partial<ThreatSignal> = {}): ThreatSignal {
  return {
    sourceAddress: "0x00000000000000000000000000000000000000aa",
    spenderAddress: "0x00000000000000000000000000000000000000dd",
    targetVictim: "0x00000000000000000000000000000000000000bb",
    tokenAddress: "0x00000000000000000000000000000000000000cc",
    amount: 5_000n * 10n ** 18n,
    eventName: "AttackInitiated",
    txHash: "0x" + "1".repeat(64),
    blockNumber: 123,
    ...overrides,
  };
}

test("attack + outflow + uncertified spender clamps to 100 and sweeps", () => {
  const result = ThreatScorer.evaluate(signal(), 1);
  assert.equal(result.threatScore, 100);
  assert.equal(result.severity, "CRITICAL");
  assert.equal(result.shouldDefend, true);
  assert.equal(result.recommendedAction, "TRIGGER_EMERGENCY_SWEEP");
  assert.ok(result.reasons.length >= 3);
});

test("conservative mode does not defend a 65-point signal", () => {
  const result = ThreatScorer.evaluate(signal({ amount: 0n }), 0);
  assert.equal(
    result.threatScore,
    RULE_WEIGHTS.attackSignature + RULE_WEIGHTS.unverifiedSpender
  );
  assert.equal(result.shouldDefend, false);
  assert.equal(result.recommendedAction, "ALERT_ONLY");
});

test("balanced mode defends the same 65-point signal with a revoke", () => {
  const result = ThreatScorer.evaluate(signal({ amount: 0n }), 1);
  assert.equal(result.threatScore, 65);
  assert.equal(result.shouldDefend, true);
  assert.equal(result.recommendedAction, "TRIGGER_EMERGENCY_REVOKE");
});

test("benign signal stays below every threshold", () => {
  const result = ThreatScorer.evaluate(
    signal({ eventName: "Transfer", amount: 0n }),
    2
  );
  assert.equal(result.threatScore, RULE_WEIGHTS.unverifiedSpender);
  assert.equal(result.severity, "LOW");
  assert.equal(result.shouldDefend, false);
  assert.equal(result.recommendedAction, "NO_ACTION");
});

test("mode helpers map enum values to names and thresholds", () => {
  assert.equal(modeName(0), "CONSERVATIVE");
  assert.equal(modeName(1), "BALANCED");
  assert.equal(modeName(2), "AGGRESSIVE");
  assert.equal(modeName(99), "BALANCED");
  assert.equal(thresholdForMode(0), DEFENSE_THRESHOLDS.CONSERVATIVE);
  assert.equal(thresholdForMode(1), DEFENSE_THRESHOLDS.BALANCED);
  assert.equal(thresholdForMode(2), DEFENSE_THRESHOLDS.AGGRESSIVE);
});
