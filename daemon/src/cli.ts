#!/usr/bin/env node
import dns from "node:dns";
// Prioritize IPv4 to prevent IPv6 ENETUNREACH timeouts on Portaldot RPC
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { ethers } from "ethers";
import { CONFIG } from "./config.js";
import { ThreatScorer } from "./threatScorer.js";
import { telegramNotifier } from "./telegramNotifier.js";

const STATIC_NETWORK = new ethers.Network(CONFIG.network.name, CONFIG.network.chainId);

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const req = new ethers.FetchRequest(CONFIG.network.rpcUrl);
  req.timeout = 10000;
  return new ethers.JsonRpcProvider(req, STATIC_NETWORK, {
    staticNetwork: STATIC_NETWORK,
  });
}

async function cmdNodeHealth() {
  console.log("==================================================================");
  console.log("   [NODE] PORTALDOT V3 EVM NODE TELEMETRY & HEALTH CHECK              ");
  console.log("==================================================================");
  const start = Date.now();
  try {
    const provider = await getProvider();
    const [blockNumber, feeData, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getFeeData(),
      provider.getNetwork(),
    ]);
    const latency = Date.now() - start;
    const block = await provider.getBlock(blockNumber);

    console.log(`[OK] Status:           ONLINE (Responsive)`);
    console.log(`[LATENCY]  RPC Latency:      ${latency} ms`);
    console.log(`[CHAIN]  Network Name:     ${network.name}`);
    console.log(`[CHAIN_ID] Chain ID:         ${network.chainId.toString()} (0x${network.chainId.toString(16)})`);
    console.log(`[BLOCK] Latest Block:     #${blockNumber}`);
    console.log(`[TIME] Block Timestamp:  ${block ? new Date(Number(block.timestamp) * 1000).toISOString() : "N/A"}`);
    console.log(`[GAS] Gas Price:        ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "0"} Gwei`);
    console.log(`[SENTINEL]  EVM Architecture: PolkaVM / pallet-revive (RISC-V Substrate EVM)`);
    console.log(`[RPC] RPC Endpoint:     ${CONFIG.network.rpcUrl}`);
    console.log(`[CONSOLE] Node Console:     https://node-console.portaldot.dev/`);
    console.log("==================================================================");
  } catch (error: any) {
    console.error(`[ERROR] Health Check Failed: ${error.message}`);
    process.exit(1);
  }
}

async function cmdAudit(targetAddress: string) {
  if (!targetAddress || !ethers.isAddress(targetAddress)) {
    console.error("[ERROR] Error: Invalid EVM address provided.");
    console.log("Usage: npm run cli audit <address>");
    process.exit(1);
  }

  console.log("==================================================================");
  console.log(`   [INSPECT] AUDITING ACCOUNT / CONTRACT ON PORTALDOT V3:                `);
  console.log(`   ${targetAddress}                                               `);
  console.log("==================================================================");

  try {
    const provider = await getProvider();
    const [balance, code, txCount] = await Promise.all([
      provider.getBalance(targetAddress),
      provider.getCode(targetAddress),
      provider.getTransactionCount(targetAddress),
    ]);

    const isContract = code !== "0x";

    console.log(`[TOKEN]  Account Type:     ${isContract ? "Smart Contract / Router" : "Externally Owned Account (EOA)"}`);
    console.log(`[ASSET] Native Balance:   ${ethers.formatEther(balance)} tPOT`);
    console.log(`[CHAIN_ID] Nonce / Tx Count: ${txCount}`);
    console.log(`[CONTRACT] Bytecode Size:    ${isContract ? (code.length - 2) / 2 : 0} bytes`);

    // Check mock test token balance if available
    try {
      const mockToken = new ethers.Contract(
        CONFIG.contracts.mockToken,
        [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address, address) view returns (uint256)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
        ],
        provider
      );
      const [tokenBal, symbol, decimals] = await Promise.all([
        mockToken.balanceOf(targetAddress),
        mockToken.symbol(),
        mockToken.decimals(),
      ]);
      console.log(`[TOKEN] ${symbol} Balance:    ${ethers.formatUnits(tokenBal, decimals)} ${symbol}`);

      // Check allowance against exploit fixture
      const allowance = await mockToken.allowance(targetAddress, CONFIG.contracts.mockExploit);
      console.log(`[UNLIMITED] Allowance -> Exploiter: ${ethers.formatUnits(allowance, decimals)} ${symbol}`);
      if (allowance > 0n) {
        console.log(`[WARN]  CRITICAL VULNERABILITY: Unlimited or active allowance granted to test exploit fixture!`);
      } else {
        console.log(`[OK] Safe: Zero allowance granted to known suspicious spenders.`);
      }
    } catch {
      // Mock token query optional
    }

    // Check Sentinel Registry
    try {
      const registry = new ethers.Contract(
        CONFIG.contracts.registry,
        [
          "function isShieldActive(address) view returns (bool)",
          "function getUserPolicy(address) view returns (tuple(uint8 mode, address emergencySafe, bool autoRevokeEnabled, bool autoSweepEnabled, uint256 maxOutflowPerHour, uint256 registeredAt, bool active))",
        ],
        provider
      );
      const isActive = await registry.isShieldActive(targetAddress);
      console.log(`[SENTINEL]  Sentinel Protection: ${isActive ? "[SAFE] ACTIVE (Circuit breaker armed)" : "[CRITICAL] INACTIVE"}`);
      if (isActive) {
        const policy = await registry.getUserPolicy(targetAddress);
        const modes = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"];
        console.log(`   - Policy Mode:   ${modes[policy.mode] || "BALANCED"}`);
        console.log(`   - Cold Safe:     ${policy.emergencySafe}`);
        console.log(`   - Auto-Revoke:   ${policy.autoRevokeEnabled}`);
        console.log(`   - Auto-Sweep:    ${policy.autoSweepEnabled}`);
      }
    } catch {
      // Registry query optional
    }

    console.log("==================================================================");
  } catch (error: any) {
    console.error(`[ERROR] Audit Failed: ${error.message}`);
    process.exit(1);
  }
}

async function cmdThreatMatrix() {
  console.log("==================================================================");
  console.log("   [ANOMALY] PORTALSENTINEL AUTONOMOUS THREAT SCORING MATRIX            ");
  console.log("==================================================================");
  console.log("Rule 1: Direct Attack & Drain Call Detection");
  console.log("   Weight: +100 Points");
  console.log("   Trigger: Function signature matching malicious drain (e.g., executeDrain)");
  console.log("");
  console.log("Rule 2: Outflow Volume Velocity (Per Block)");
  console.log("   Weight: +30 to +60 Points");
  console.log("   Trigger: Outflow exceeding 50% or high single-tx volume limit");
  console.log("");
  console.log("Rule 3: Uncertified Spender Contract Status");
  console.log("   Weight: +25 Points");
  console.log("   Trigger: Spender not in Portaldot Verified Protocol Directory");
  console.log("");
  console.log("Decision Matrix by Sensitivity Mode:");
  console.log("   [SENTINEL]  CONSERVATIVE: Defend threshold >= 40 points");
  console.log("   [ALLOWANCE]  BALANCED:     Defend threshold >= 65 points");
  console.log("   [EXEC] AGGRESSIVE:   Defend threshold >= 80 points");
  console.log("==================================================================");
}

async function cmdBenchmark() {
  console.log("==================================================================");
  console.log("   [EXEC] RUNNING PORTALDOT V3 RPC BENCHMARK (5 Iterations)...        ");
  console.log("==================================================================");
  const provider = await getProvider();
  const times: number[] = [];

  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    await provider.getBlockNumber();
    const dt = Date.now() - t0;
    times.push(dt);
    console.log(`   Ping #${i}: ${dt} ms`);
  }

  const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log("------------------------------------------------------------------");
  console.log(`   Average: ${avg} ms | Min: ${min} ms | Max: ${max} ms`);
  console.log("==================================================================");
}

async function cmdTelegramTest(targetChatId?: string) {
  console.log("==================================================================");
  console.log("   [TELEGRAM] PORTALSENTINEL TELEGRAM ALERT SYSTEM VERIFICATION           ");
  console.log("==================================================================");
  console.log(`Bot Token Configured: ${CONFIG.telegram.botToken ? "YES (live)" : "NO (simulated mode)"}`);
  console.log(`Target Chat ID:       ${targetChatId || CONFIG.telegram.chatId || "(None set - previewing log)"}`);
  console.log("Dispatching test alert notification...\n");

  await telegramNotifier.sendTestPing(targetChatId);

  console.log("\n==================================================================");
  console.log("   [OK] Telegram test sequence completed successfully!              ");
  console.log("==================================================================");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  switch (command) {
    case "health":
    case "node-health":
    case "status":
      await cmdNodeHealth();
      break;

    case "audit":
    case "inspect":
      await cmdAudit(args[1]);
      break;

    case "matrix":
    case "rules":
      await cmdThreatMatrix();
      break;

    case "benchmark":
    case "ping":
      await cmdBenchmark();
      break;

    case "telegram":
    case "telegram:test":
    case "notify":
      await cmdTelegramTest(args[1]);
      break;

    case "help":
    default:
      console.log("==================================================================");
      console.log("   [SENTINEL]  PORTALSENTINEL CLI — NODE OPERATIONS & TOOLING SUITE       ");
      console.log("==================================================================");
      console.log("Commands:");
      console.log("   npm run cli health             Check Portaldot V3 EVM & Substrate node health");
      console.log("   npm run cli audit <address>    Audit an EOA or contract for allowances & risk");
      console.log("   npm run cli matrix             View heuristic threat scoring rules");
      console.log("   npm run cli benchmark          Benchmark RPC latency across multiple requests");
      console.log("   npm run cli telegram:test      Test Telegram bot notification dispatch");
      console.log("==================================================================");
      break;
  }
}

main().catch((err) => {
  console.error("CLI error:", err);
  process.exit(1);
});
