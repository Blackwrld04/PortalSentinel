import { CONFIG } from "./config.js";
import { BlockStreamListener } from "./listener.js";
import { ThreatScorer } from "./threatScorer.js";
import { DefenseDispatcher } from "./dispatcher.js";

async function main() {
  console.log("==================================================================");
  console.log("   🛡️  PORTALSENTINEL DAEMON — CLOSED-LOOP SECURITY ENGINE       ");
  console.log("==================================================================");
  console.log(`🌐 Network:          ${CONFIG.network.name} (Chain ID: ${CONFIG.network.chainId})`);
  console.log(`🔗 RPC:              ${CONFIG.network.rpcUrl}`);
  console.log(`📑 Registry:         ${CONFIG.contracts.registry}`);
  console.log(`⚡ Executor:         ${CONFIG.contracts.executor}`);
  console.log(`🎯 Exploit Fixture:  ${CONFIG.contracts.mockExploit}`);
  console.log("==================================================================\n");

  const dispatcher = new DefenseDispatcher();
  const listener = new BlockStreamListener();

  await listener.start(async (signal) => {
    console.log(`\n🚨 [THREAT DETECTED] Block #${signal.blockNumber}`);
    console.log(`   Source (Attacker): ${signal.sourceAddress}`);
    console.log(`   Target (Victim):   ${signal.targetVictim}`);
    console.log(`   Tx Hash:           ${signal.txHash}`);

    // Check if user is enrolled in Sentinel protection
    const isProtected = await dispatcher.isUserProtected(signal.targetVictim);

    if (!isProtected) {
      console.log(`⚠️ User ${signal.targetVictim} is NOT enrolled in Sentinel Shield. Skipping.`);
      return;
    }

    // Evaluate risk score
    const evaluation = ThreatScorer.evaluate(signal, 1); // 1 = BALANCED mode

    console.log(`📊 Threat Score:      ${evaluation.threatScore}/100 [${evaluation.severity}]`);
    console.log(`💡 Recommendation:    ${evaluation.recommendedAction}`);

    if (evaluation.shouldDefend) {
      const result = await dispatcher.dispatchDefense(signal, evaluation);
      if (result.success) {
        console.log(`🎉 [INCIDENT RESOLVED] Front-ran attacker in ${result.latencyMs}ms!`);
      } else {
        console.error(`💥 [DEFENSE FAILED] Manual intervention required.`);
      }
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT. Shutting down PortalSentinel daemon...");
    listener.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal daemon error:", err);
  process.exit(1);
});
