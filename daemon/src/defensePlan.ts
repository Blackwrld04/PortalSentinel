export type DefenseAction =
  | "TRIGGER_EMERGENCY_REVOKE"
  | "TRIGGER_EMERGENCY_SWEEP";

export interface ViabilityInputs {
  /** Allowance the executor holds for the victim (needed for a sweep). */
  executorAllowance: bigint | null;
  /** Allowance the attack spender holds (needed for a revoke). */
  spenderAllowance: bigint | null;
  /** Victim token balance (needed for a sweep). */
  balance: bigint | null;
}

export interface DefenseSelection {
  action: DefenseAction | null;
  /** True when the requested action was not executable and another was chosen. */
  fellBack: boolean;
  reason?: string;
}

/**
 * Picks an action that can actually execute on-chain.
 *
 * A recommended sweep requires both a victim balance and an allowlisted
 * allowance to the executor; otherwise the transaction would revert. In that
 * case, revoke the dangerous allowance instead. Unknown values (RPC failure)
 * keep the requested action rather than refusing to defend on partial data.
 */
export function selectDefenseAction(
  requested: DefenseAction,
  inputs: ViabilityInputs
): DefenseSelection {
  const sweepViable =
    inputs.executorAllowance === null || inputs.balance === null
      ? true
      : inputs.executorAllowance > 0n && inputs.balance > 0n;
  const revokeViable =
    inputs.spenderAllowance === null ? true : inputs.spenderAllowance > 0n;

  if (
    (requested === "TRIGGER_EMERGENCY_SWEEP" && sweepViable) ||
    (requested === "TRIGGER_EMERGENCY_REVOKE" && revokeViable)
  ) {
    return { action: requested, fellBack: false };
  }

  if (sweepViable) {
    return { action: "TRIGGER_EMERGENCY_SWEEP", fellBack: true };
  }
  if (revokeViable) {
    return { action: "TRIGGER_EMERGENCY_REVOKE", fellBack: true };
  }

  return {
    action: null,
    fellBack: false,
    reason:
      "User has no revocable allowance to the spender and no sweepable balance/allowance",
  };
}
