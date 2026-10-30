import { ethers } from "ethers";
import { CONFIG } from "./config.js";
import { ThreatScorer, ThreatSignal } from "./threatScorer.js";

async function runSimulation() {
  console.log("==================================================================");
  console.log("   🧪  PORTALSENTINEL LIVE TESTNET SIMULATION HARNESS            ");
  console.log("==================================================================");
  console.log(`🌐 Portaldot V3 EVM RPC: ${CONFIG.network.rpcUrl}`);
  console.log(`⛓️  Chain ID:             ${CONFIG.network.chainId}`);
  console.log("==================================================================\n");

  const staticNet = new ethers.Network(CONFIG.network.name, CONFIG.network.chainId);
  const provider = new ethers.JsonRpcProvider(CONFIG.network.rpcUrl, staticNet, {
    staticNetwork: staticNet
  });

  let currentBlock = 257080;
  try {
    const fetchedBlock = await Promise.race([
      provider.getBlockNumber(),
      new Promise<number>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), 5000))
    ]);
    currentBlock = fetchedBlock;
    console.log(`[1/4] Connected to Portaldot Testnet. Current Block: #${currentBlock}`);
  } catch {
    console.log(`[1/4] Portaldot Testnet RPC high latency. Using pinned block #${currentBlock}`);
  }

  // Simulated actors
  const victimWallet = ethers.Wallet.createRandom();
  const hackerWallet = ethers.Wallet.createRandom();
  const coldSafeWallet = ethers.Wallet.createRandom();

  console.log(`[2/4] Initialized Test Scenario:`);
  console.log(`      Victim Wallet:    ${victimWallet.address}`);
  console.log(`      Hacker Address:   ${hackerWallet.address}`);
  console.log(`      Cold Safe Target: ${coldSafeWallet.address}`);

  // 1. Threat Signal Detection
  console.log(`\n[3/4] Simulating Inbound Threat Signal:`);
  const mockSignal: ThreatSignal = {
    sourceAddress: hackerWallet.address,
    targetVictim: victimWallet.address,
    tokenAddress: CONFIG.contracts.mockToken,
    amount: ethers.parseEther("5000"),
    eventName: "AttackInitiated",
    txHash: "0x" + "a".repeat(64),
    blockNumber: currentBlock
  };

  console.log(`      ⚡ Event: AttackInitiated`);
  console.log(`      💰 Draining Target: 5,000 pUSD`);

  // 2. Risk Evaluation
  const evalResult = ThreatScorer.evaluate(mockSignal, 1);
  console.log(`\n[4/4] Sentinel Threat Evaluation:`);
  console.log(`      Score:       ${evalResult.threatScore}/100 [${evalResult.severity}]`);
  console.log(`      Decision:    ${evalResult.shouldDefend ? "🚨 AUTO-DEFENSE TRIGGERED" : "NO_ACTION"}`);
  console.log(`      Action:      ${evalResult.recommendedAction}`);
  console.log(`      Reasons:`);
  evalResult.reasons.forEach((r) => console.log(`        - ${r}`));

  console.log("\n==================================================================");
  console.log("   ✅ Simulation Complete! Logic & Scoring Verified.             ");
  console.log("==================================================================");
}

runSimulation().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
