import { CONFIG } from "./config.js";
import { BlockStreamListener } from "./listener.js";
import { ThreatScorer } from "./threatScorer.js";
import { DefenseDispatcher } from "./dispatcher.js";
import { telegramNotifier } from "./telegramNotifier.js";
import { metricsServer } from "./metrics.js";

async function main() {
  console.log("==================================================================");
  console.log("   [SENTINEL]  PORTALSENTINEL DAEMON — CLOSED-LOOP SECURITY ENGINE       ");
  console.log("==================================================================");
  console.log(`[NET] Network:          ${CONFIG.network.name} (Chain ID: ${CONFIG.network.chainId})`);
  console.log(`[RPC] RPC:              ${CONFIG.network.rpcUrl}`);
  console.log(`[REGISTRY] Registry:         ${CONFIG.contracts.registry}`);
  console.log(`[EXEC] Executor:         ${CONFIG.contracts.executor}`);
  console.log(`[TARGET] Exploit Fixture:  ${CONFIG.contracts.mockExploit}`);
  console.log(`[TELEGRAM] Telegram Alerts:  ${CONFIG.telegram.enabled ? "ACTIVE (24/7 Push)" : "DISABLED"}`);
  console.log(`[MODE] Execution Mode:   ${CONFIG.guardian.dryRun ? "DRY RUN (no transactions broadcast)" : "LIVE (broadcasting defenses)"}`);
  if (CONFIG.guardian.dryRun) {
    console.log(`[WARN] Dry-run enabled. Set DRY_RUN=false and provide GUARDIAN_PRIVATE_KEY to broadcast.`);
  }
  console.log("==================================================================\n");

  await metricsServer.start();

  const dispatcher = new DefenseDispatcher();
  await dispatcher.verifyConfiguration();
  const listener = new BlockStreamListener();
  await listener.start(async (signal) => {
    console.log(`\n[ALERT] [THREAT DETECTED] Block #${signal.blockNumber}`);
    console.log(`   Source (Attacker): ${signal.sourceAddress}`);
    console.log(`   Approved Spender:  ${signal.spenderAddress}`);
    console.log(`   Target (Victim):   ${signal.targetVictim}`);
    console.log(`   Tx Hash:           ${signal.txHash}`);

    // Check if user is enrolled in Sentinel protection and read their real policy mode.
    const policy = await dispatcher.getUserPolicy(signal.targetVictim);

    if (!policy?.isActive) {
      console.log(`[WARN] User ${signal.targetVictim} is NOT enrolled in Sentinel Shield. Skipping.`);
      return;
    }

    // Evaluate risk score using the user's on-chain sensitivity mode.
    const evaluation = ThreatScorer.evaluate(signal, policy.mode);

    console.log(`[SCORE] Threat Score:      ${evaluation.threatScore}/100 [${evaluation.severity}]`);
    console.log(`[REC] Recommendation:    ${evaluation.recommendedAction}`);

    metricsServer.incrementMetric("threatsDetected");
    // Send the Telegram advisory to the victim
    const threatAlertSent = await telegramNotifier.sendThreatDetectedAlert(signal, evaluation);
    if (threatAlertSent) {
      metricsServer.incrementMetric("alertsSent");
    }

    if (evaluation.shouldDefend) {
      const result = await dispatcher.dispatchDefense(signal, evaluation);

      if (result.duplicate) {
        console.log(`[SENTINEL] Duplicate defense suppressed; no alert sent.`);
        return;
      }

      // Dispatch follow-up resolution alert to Telegram
      const defenseAlertSent = await telegramNotifier.sendDefenseExecutedAlert(
        result,
        signal,
        evaluation
      );
      if (defenseAlertSent) {
        metricsServer.incrementMetric("alertsSent");
      }

      metricsServer.updateMetric("lastDefenseLatencyMs", result.latencyMs);

      if (result.success) {
        if (result.simulated) {
          metricsServer.incrementMetric("defensesSimulated");
          console.log(
            `[DRY RUN] Defense simulated for ${signal.targetVictim} in ${result.latencyMs}ms — no transaction broadcast.`
          );
        } else {
          metricsServer.incrementMetric("defensesExecuted");
          console.log(
            `[RESOLVED] [INCIDENT RESOLVED] Defense confirmed on-chain in ${result.latencyMs}ms.`
          );
        }
      } else {
        metricsServer.incrementMetric("defensesFailed");
        console.error(
          `[FAILED] [DEFENSE FAILED] ${result.error || "unknown error"} — manual intervention required.`
        );
      }
    }
  });

  // Handle graceful shutdown on both Ctrl-C and service-manager termination.
  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`\nReceived ${signal}. Shutting down PortalSentinel daemon...`);
    metricsServer.stop();
    listener.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal daemon error:", err);
  process.exit(1);
});
