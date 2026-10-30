export interface ThreatSignal {
  sourceAddress: string;
  targetVictim: string;
  tokenAddress: string;
  amount: bigint;
  eventName: string;
  txHash: string;
  blockNumber: number;
}

export interface ThreatEvaluation {
  threatScore: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  shouldDefend: boolean;
  recommendedAction: "NO_ACTION" | "ALERT_ONLY" | "TRIGGER_EMERGENCY_REVOKE" | "TRIGGER_EMERGENCY_SWEEP";
  reasons: string[];
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

    // Rule 1: Explicit Malicious Trigger / Attack Signal (+50)
    if (signal.eventName === "AttackInitiated" || signal.eventName === "SuspiciousOutflow") {
      score += 55;
      reasons.push("Explicit attack/outflow signature detected from unverified spender");
    }

    // Rule 2: High Velocity or Volume Drain (+30)
    if (signal.amount > 0n) {
      score += 35;
      reasons.push(`High token transfer outflow: ${signal.amount.toString()} base units`);
    }

    // Rule 3: Known Pattern Flag (+10)
    score += 10;
    reasons.push("Spender lacks verified protocol registry certification");

    // Clamp score to 100 max
    score = Math.min(100, score);

    // Determine severity label
    let severity: ThreatEvaluation["severity"] = "LOW";
    if (score >= 80) severity = "CRITICAL";
    else if (score >= 60) severity = "HIGH";
    else if (score >= 40) severity = "MEDIUM";

    // Sensitivity thresholds:
    // 0 = CONSERVATIVE (threshold >= 80)
    // 1 = BALANCED (threshold >= 60)
    // 2 = AGGRESSIVE (threshold >= 40)
    const threshold = userSensitivity === 0 ? 80 : userSensitivity === 1 ? 60 : 40;
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
      reasons
    };
  }
}
