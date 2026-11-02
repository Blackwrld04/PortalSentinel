import test from "node:test";
import assert from "node:assert/strict";

import { selectDefenseAction } from "./defensePlan.js";

const ZERO = 0n;
const SOME = 1_000n;

test("sweep is kept when the executor allowance and balance are both positive", () => {
  const result = selectDefenseAction("TRIGGER_EMERGENCY_SWEEP", {
    executorAllowance: SOME,
    spenderAllowance: SOME,
    balance: SOME,
  });
  assert.equal(result.action, "TRIGGER_EMERGENCY_SWEEP");
  assert.equal(result.fellBack, false);
});

test("sweep falls back to revoke when the executor has no allowance", () => {
  const result = selectDefenseAction("TRIGGER_EMERGENCY_SWEEP", {
    executorAllowance: ZERO,
    spenderAllowance: SOME,
    balance: SOME,
  });
  assert.equal(result.action, "TRIGGER_EMERGENCY_REVOKE");
  assert.equal(result.fellBack, true);
});

test("sweep falls back to revoke when the victim balance is zero", () => {
  const result = selectDefenseAction("TRIGGER_EMERGENCY_SWEEP", {
    executorAllowance: SOME,
    spenderAllowance: SOME,
    balance: ZERO,
  });
  assert.equal(result.action, "TRIGGER_EMERGENCY_REVOKE");
  assert.equal(result.fellBack, true);
});

test("revoke falls back to sweep when the spender allowance is already zero", () => {
  const result = selectDefenseAction("TRIGGER_EMERGENCY_REVOKE", {
    executorAllowance: SOME,
    spenderAllowance: ZERO,
    balance: SOME,
  });
  assert.equal(result.action, "TRIGGER_EMERGENCY_SWEEP");
  assert.equal(result.fellBack, true);
});

test("no action is chosen when neither revoke nor sweep can execute", () => {
  const result = selectDefenseAction("TRIGGER_EMERGENCY_SWEEP", {
    executorAllowance: ZERO,
    spenderAllowance: ZERO,
    balance: SOME,
  });
  assert.equal(result.action, null);
  assert.match(result.reason ?? "", /no revocable allowance/i);
});

test("unknown on-chain values keep the requested action instead of refusing", () => {
  const result = selectDefenseAction("TRIGGER_EMERGENCY_SWEEP", {
    executorAllowance: null,
    spenderAllowance: null,
    balance: null,
  });
  assert.equal(result.action, "TRIGGER_EMERGENCY_SWEEP");
  assert.equal(result.fellBack, false);
});
