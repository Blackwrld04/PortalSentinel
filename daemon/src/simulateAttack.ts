import dns from "node:dns";
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { ethers } from "ethers";
import { CONFIG } from "./config.js";
import { ThreatScorer, ThreatSignal } from "./threatScorer.js";
import { telegramNotifier } from "./telegramNotifier.js";
import type { DefenseDispatchResult } from "./dispatcher.js";

async function runAttackSimulation() {
  console.log("==================================================================");
  console.log("   [TEST]  PORTALSENTINEL LIVE TESTNET SIMULATION HARNESS            ");
  console.log("==================================================================");
  console.log(`[NET] Portaldot V3 EVM RPC: ${CONFIG.network.rpcUrl}`);
  console.log(`[CHAIN]  Chain ID:             ${CONFIG.network.chainId}`);
  console.log(`[TELEGRAM] Telegram Bot Alert:   Armed`);
  console.log("==================================================================\n");

  const staticNet = new ethers.Network(CONFIG.network.name, CONFIG.network.chainId);
  const req = new ethers.FetchRequest(CONFIG.network.rpcUrl);
  req.timeout = 10000;
  const provider = new ethers.JsonRpcProvider(req, staticNet, { staticNetwork: staticNet });

  let currentBlock = 0;
  try {
    currentBlock = await provider.getBlockNumber();
    console.log(`[1/5] Connected to Portaldot Testnet. Current Block: #${currentBlock}`);
  } catch (err: any) {
    console.log(`[1/5] Portaldot Testnet ping timed out or offline, using fallback mock block #257850`);
    currentBlock = 257850;
  }

  // Generate synthetic mock scenario
  const victimWallet = ethers.Wallet.createRandom().address;
  const hackerWallet = ethers.Wallet.createRandom().address;
  const coldSafeTarget = ethers.Wallet.createRandom().address;

  console.log(`[2/5] Initialized Test Scenario:`);
  console.log(`      Victim Wallet:    ${victimWallet}`);
  console.log(`      Hacker Address:   ${hackerWallet}`);
  console.log(`      Cold Safe Target: ${coldSafeTarget}`);

  const mockSignal: ThreatSignal = {
    sourceAddress: hackerWallet,
    spenderAddress: CONFIG.contracts.mockExploit,
    targetVictim: victimWallet,
    tokenAddress: CONFIG.contracts.mockToken,
    amount: ethers.parseUnits("5000", 18),
    eventName: "AttackInitiated",
    // No on-chain transaction exists: keep the hash explicitly empty rather than fake.
    txHash: "0x" + "0".repeat(64),
    blockNumber: currentBlock,
    simulated: true
  };

  console.log(`\n[3/5] Simulating Inbound Threat Signal:`);
  console.log(`      [EXEC] Event: ${mockSignal.eventName}`);
  console.log(`      [ASSET] Draining Target: 5,000 pUSD`);
  console.log(`      [NOTE] Synthetic signal — no transaction was broadcast.`);

  // Run threat scoring engine
  const evalResult = ThreatScorer.evaluate(mockSignal, 1); // 1 = BALANCED

  console.log(`\n[4/5] Sentinel Threat Evaluation:`);
  console.log(`      Score:       ${evalResult.threatScore}/100 [${evalResult.severity}]`);
  console.log(`      Decision:    ${evalResult.shouldDefend ? "[ALERT] AUTO-DEFENSE WOULD TRIGGER" : "PASS"}`);
  console.log(`      Action:      ${evalResult.recommendedAction}`);
  console.log(`      Reasons:`);
  for (const reason of evalResult.reasons) {
    console.log(`        - ${reason}`);
  }

  console.log(`\n[5/5] Sending Telegram Advisories (if configured)...`);
  const threatAlertSent = await telegramNotifier.sendThreatDetectedAlert(mockSignal, evalResult);

  const mockDefenseResult: DefenseDispatchResult = {
    success: true,
    simulated: true,
    duplicate: false,
    txHash: "",
    blockNumber: 0,
    latencyMs: 0,
    actionExecuted: evalResult.recommendedAction,
    attempts: 0
  };

  const defenseAlertSent = await telegramNotifier.sendDefenseExecutedAlert(mockDefenseResult, mockSignal, evalResult);

  console.log("\n==================================================================");
  console.log("   [OK] Simulation complete. No on-chain transaction was broadcast.");
  console.log(
    `   Telegram advisories: ${threatAlertSent && defenseAlertSent ? "sent" : "not sent (disabled or failed)"}`
  );
  console.log("==================================================================");
}

runAttackSimulation().catch((err) => {
  console.error("Simulation failure:", err);
  process.exit(1);
});
