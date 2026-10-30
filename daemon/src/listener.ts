import dns from "node:dns";
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { ethers } from "ethers";
import { CONFIG } from "./config.js";
import { ThreatSignal } from "./threatScorer.js";

export type ThreatSignalCallback = (signal: ThreatSignal) => void;

export class BlockStreamListener {
  private provider: ethers.JsonRpcProvider;
  private lastScannedBlock: number = 0;
  private isRunning: boolean = false;
  private callback: ThreatSignalCallback | null = null;

  constructor() {
    const staticNet = new ethers.Network(CONFIG.network.name, CONFIG.network.chainId);
    const req = new ethers.FetchRequest(CONFIG.network.rpcUrl);
    req.timeout = 10000;
    this.provider = new ethers.JsonRpcProvider(req, staticNet, { staticNetwork: staticNet });
  }

  public async start(onSignal: ThreatSignalCallback) {
    this.callback = onSignal;
    this.isRunning = true;

    try {
      this.lastScannedBlock = await this.provider.getBlockNumber();
      console.log(`📡 [BLOCK LISTENER] Connected to ${CONFIG.network.name}`);
      console.log(`   🔗 RPC: ${CONFIG.network.rpcUrl}`);
      console.log(`   🧱 Starting from Block #${this.lastScannedBlock}`);
    } catch (err: any) {
      console.error(`❌ Failed to fetch starting block:`, err.message);
      this.lastScannedBlock = 0;
    }

    this.pollLoop();
  }

  public stop() {
    this.isRunning = false;
    console.log("🛑 [BLOCK LISTENER] Stopped.");
  }

  private async pollLoop() {
    while (this.isRunning) {
      try {
        const currentBlock = await this.provider.getBlockNumber();

        if (currentBlock > this.lastScannedBlock) {
          for (let b = this.lastScannedBlock + 1; b <= currentBlock; b++) {
            await this.processBlock(b);
          }
          this.lastScannedBlock = currentBlock;
        }
      } catch (err: any) {
        // Suppress transient RPC connection errors
      }

      await new Promise((r) => setTimeout(r, CONFIG.network.blockTimeMs));
    }
  }

  private async processBlock(blockNumber: number) {
    try {
      const filter = {
        fromBlock: blockNumber,
        toBlock: blockNumber
      };

      const logs = await this.provider.getLogs(filter);

      for (const log of logs) {
        const attackTopic = ethers.id("AttackInitiated(address,address,uint256,uint256)");

        if (log.topics[0] === attackTopic && log.topics.length >= 3) {
          const victim = ethers.getAddress("0x" + log.topics[1].slice(26));
          const attacker = ethers.getAddress("0x" + log.topics[2].slice(26));

          const signal: ThreatSignal = {
            sourceAddress: attacker,
            targetVictim: victim,
            tokenAddress: CONFIG.contracts.mockToken,
            amount: 1000n * 10n ** 18n,
            eventName: "AttackInitiated",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber
          };

          if (this.callback) {
            this.callback(signal);
          }
        }
      }
    } catch {
      // Graceful block skip on RPC timeout
    }
  }
}
