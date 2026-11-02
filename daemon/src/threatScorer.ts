export interface ThreatSignal {
  /** EOA or contract that initiated the attack (for reporting). */
  sourceAddress: string;
  /** Contract that actually holds the dangerous allowance and must be revoked. */
  spenderAddress: string;
  targetVictim: string;
  tokenAddress: string;
  amount: bigint;
  eventName: string;
  txHash: string;
  blockNumber: number;
  /** True when the signal came from the offline demo harness, not from a block. */
  simulated?: boolean;
}

export interface ThreatEvaluation {
  threatScore: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  shouldDefend: boolean;
  recommendedAction: "NO_ACTION" | "ALERT_ONLY" | "TRIGGER_EMERGENCY_REVOKE" | "TRIGGER_EMERGENCY_SWEEP";
  reasons: string[];
}

/** Must match SentinelRegistry.DefenseMode enum order. */
export const DEFENSE_MODES = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const;
export type DefenseModeName = (typeof DEFENSE_MODES)[number];

/** Must match the thresholds documented in the registry and CLI. */
export const DEFENSE_THRESHOLDS: Record<DefenseModeName, number> = {
  CONSERVATIVE: 80,
  BALANCED: 60,
  AGGRESSIVE: 40,
};

/**
 * Detection weights. Kept in one place so the CLI matrix, docs, and tests cannot drift.
 * These are heuristics for the current block-scanner signal; the P1 scorer replaces
 * them with velocity/reputation features.
 */
export const RULE_WEIGHTS = {
  attackSignature: 55,
  outflow: 35,
  unverifiedSpender: 10,
} as const;

export function modeName(mode: number): DefenseModeName {
  return DEFENSE_MODES[mode] ?? "BALANCED";
}

export function thresholdForMode(mode: number): number {
  return DEFENSE_THRESHOLDS[modeName(mode)];
}

export class ThreatScorer {
  /**
   * Evaluates an observed on-chain signal against risk models.
   * @param signal The raw threat signal captured from the block stream.
   * @param userSensitivity The protected user's sensitivity level (0=CONSERVATIVE, 1=BALANCED, 2=AGGRESSIVE).
   */
  public static evaluate(
    signal: ThreatSignal,
    userSensitivity: number = 1 // Default BALANCED
  ): ThreatEvaluation {
    let score = 0;
    const reasons: string[] = [];

    // Rule 1: Explicit malicious trigger / attack signal.
    if (signal.eventName === "AttackInitiated" || signal.eventName === "SuspiciousOutflow") {
      score += RULE_WEIGHTS.attackSignature;
      reasons.push("Explicit attack/outflow signature detected from unverified spender");
    }

    // Rule 2: Non-zero token outflow.
    if (signal.amount > 0n) {
      score += RULE_WEIGHTS.outflow;
      reasons.push(`High token transfer outflow: ${signal.amount.toString()} base units`);
    }

    // Rule 3: Spender lacks a verified protocol certification (no allowlist in P0).
    score += RULE_WEIGHTS.unverifiedSpender;
    reasons.push("Spender lacks verified protocol registry certification");

    // Clamp score to 100 max.
    score = Math.min(100, score);

    // Determine severity label.
    let severity: ThreatEvaluation["severity"] = "LOW";
    if (score >= 80) severity = "CRITICAL";
    else if (score >= 60) severity = "HIGH";
    else if (score >= 40) severity = "MEDIUM";

    const threshold = thresholdForMode(userSensitivity);
    const shouldDefend = score >= threshold;

    let recommendedAction: ThreatEvaluation["recommendedAction"] = "NO_ACTION";
    if (shouldDefend) {
      recommendedAction = score >= 85 ? "TRIGGER_EMERGENCY_SWEEP" : "TRIGGER_EMERGENCY_REVOKE";
    } else if (score >= 30) {
      recommendedAction = "ALERT_ONLY";
    }

    return {
      threatScore: score,
      severity,
      shouldDefend,
      recommendedAction,
      reasons,
    };
  }
}
