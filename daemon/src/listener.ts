import dns from "node:dns";
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { ethers } from "ethers";
import { CONFIG } from "./config.js";
import { ThreatSignal } from "./threatScorer.js";
import { metricsServer } from "./metrics.js";
import { BlockStateStore } from "./state.js";

export type ThreatSignalCallback = (signal: ThreatSignal) => void | Promise<void>;

export class BlockStreamListener {
  private provider: ethers.JsonRpcProvider;
  private stateStore = new BlockStateStore();
  private lastScannedBlock: number = 0;
  private isRunning: boolean = false;
  private callback: ThreatSignalCallback | null = null;
  private consecutiveErrors: number = 0;

  constructor() {
    const staticNet = new ethers.Network(CONFIG.network.name, CONFIG.network.chainId);
    const req = new ethers.FetchRequest(CONFIG.network.rpcUrl);
    req.timeout = CONFIG.network.requestTimeoutMs;
    this.provider = new ethers.JsonRpcProvider(req, staticNet, { staticNetwork: staticNet });
  }

  public async start(onSignal: ThreatSignalCallback) {
    this.callback = onSignal;
    this.isRunning = true;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const persistedBlock = await this.stateStore.load();

      if (persistedBlock > 0 && persistedBlock <= currentBlock) {
        this.lastScannedBlock = persistedBlock;
        console.log(
          `📡 [BLOCK SCANNER] Resuming from persisted block #${persistedBlock}`
        );
      } else {
        this.lastScannedBlock = currentBlock;
        console.log(`📡 [BLOCK SCANNER] Connected to ${CONFIG.network.name}`);
        console.log(`   🔗 RPC: ${CONFIG.network.rpcUrl}`);
        console.log(`   🧱 Starting from Block #${this.lastScannedBlock}`);
      }
      console.log(
        `   👁  Watching emitter: ${CONFIG.contracts.mockExploit} (demo attack fixture)`
      );
    } catch (err: any) {
      // Fail fast: starting from block 0 on a failed connection would scan the
      // entire chain when the RPC recovers.
      throw new Error(
        `Cannot reach Portaldot RPC at ${CONFIG.network.rpcUrl}: ${err.message}`
      );
    }

    this.pollLoop();
  }

  public stop() {
    this.isRunning = false;
    console.log("🛑 [BLOCK SCANNER] Stopped.");
  }

  private async pollLoop() {
    while (this.isRunning) {
      try {
        const t0 = Date.now();
        const currentBlock = await this.provider.getBlockNumber();
        const latency = Date.now() - t0;
        this.consecutiveErrors = 0;
        metricsServer.updateMetric("rpcLatencyMs", latency);
        metricsServer.updateMetric("blockHeight", currentBlock);

        if (currentBlock > this.lastScannedBlock) {
          const pending = currentBlock - this.lastScannedBlock;
          if (pending > CONFIG.network.logRangeBlocks) {
            console.log(
              `[BLOCK SCANNER] Catching up ${pending} blocks in batches of ${CONFIG.network.logRangeBlocks}...`
            );
          }

          let from = this.lastScannedBlock + 1;
          while (from <= currentBlock) {
            const to = Math.min(
              from + CONFIG.network.logRangeBlocks - 1,
              currentBlock
            );
            await this.processRange(from, to);
            this.lastScannedBlock = to;
            // Persist after each batch: a crash mid-catch-up resumes, not replays.
            await this.stateStore.save(to);
            from = to + 1;
          }
        }
      } catch (err: any) {
        // Avoid a silent outage: log the first failure in a streak and then throttle.
        if (this.consecutiveErrors === 0) {
          console.error(
            `[BLOCK SCANNER] RPC error: ${err?.message || err}. Retrying...`
          );
        }
        this.consecutiveErrors++;
      }

      await new Promise((r) => setTimeout(r, CONFIG.network.blockTimeMs));
    }
  }

  private async processRange(fromBlock: number, toBlock: number) {
    const attackTopic = ethers.id("AttackInitiated(address,address,uint256,uint256)");
    const filter = {
      address: CONFIG.contracts.mockExploit,
      topics: [attackTopic],
      fromBlock,
      toBlock
    };

    // Let RPC failures propagate so pollLoop does not advance the persisted block
    // past events that were never read.
    const logs = await this.provider.getLogs(filter);

    for (const log of logs) {
      if (log.topics.length < 3) {
        continue;
      }

      try {
        const victim = ethers.getAddress("0x" + log.topics[1].slice(26));
        const attacker = ethers.getAddress("0x" + log.topics[2].slice(26));

        // Decode the real amount instead of reporting a hard-coded 1,000 tokens.
        const [, amount] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256", "uint256"],
          log.data
        );

        const signal: ThreatSignal = {
          sourceAddress: attacker,
          // The demo fixture holds the allowance it drains through, so the revoke
          // must target the fixture contract rather than the attacker EOA.
          spenderAddress: CONFIG.contracts.mockExploit,
          targetVictim: victim,
          tokenAddress: CONFIG.contracts.mockToken,
          amount: BigInt(amount),
          eventName: "AttackInitiated",
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        };

        if (this.callback) {
          // Await so blocks are handled in order and rejections cannot escape
          // as unhandled promise rejections. A handler failure is logged loudly;
          // the block journal still advances to avoid replaying a defense that
          // may already have been broadcast (exactly-once needs the P2 journal).
          try {
            await this.callback(signal);
          } catch (err: any) {
            console.error(
              `[SENTINEL] Signal handler failed for ${signal.txHash}: ${err?.message || err}`
            );
          }
        }
      } catch {
        // Skip a malformed event without losing the rest of the block.
        continue;
      }
    }
  }
}
