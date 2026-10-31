import dns from "node:dns";
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { ethers } from "ethers";
import { CONFIG } from "./config.js";
import { ThreatEvaluation, ThreatSignal } from "./threatScorer.js";

// Minimal ABIs
const EXECUTOR_ABI = [
  "function executeEmergencyBatchRevoke(address user, address[] calldata tokens, address[] calldata spenders) external",
  "function executeEmergencySweep(address user, address[] calldata tokens) external",
  "function simulateDefenseExecution(address user, address token, address spender, uint256 mockScore) external returns (bool)",
  "event EmergencyRevokeExecuted(address indexed user, address indexed token, address indexed spender, address operator, uint256 timestamp)",
  "event ThreatNeutralized(address indexed user, address indexed threatSpender, uint256 threatScore, string actionTaken)"
];

const REGISTRY_ABI = [
  "function isProtected(address user) external view returns (bool)",
  "function getUserPolicy(address user) external view returns (tuple(bool isActive, uint8 mode, address emergencySafe, uint256 registeredTimestamp, uint256 lastDefenseActionTimestamp))"
];

export interface DefenseDispatchResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
  latencyMs: number;
  actionExecuted: string;
}

export class DefenseDispatcher {
  private provider: ethers.JsonRpcProvider;
  private guardianWallet: ethers.Wallet;
  private executorContract: ethers.Contract;
  private registryContract: ethers.Contract;

  constructor() {
    const staticNet = new ethers.Network(CONFIG.network.name, CONFIG.network.chainId);
    const req = new ethers.FetchRequest(CONFIG.network.rpcUrl);
    req.timeout = 10000;
    this.provider = new ethers.JsonRpcProvider(req, staticNet, { staticNetwork: staticNet });
    this.guardianWallet = new ethers.Wallet(CONFIG.guardian.privateKey, this.provider);
    this.executorContract = new ethers.Contract(CONFIG.contracts.executor, EXECUTOR_ABI, this.guardianWallet);
    this.registryContract = new ethers.Contract(CONFIG.contracts.registry, REGISTRY_ABI, this.guardianWallet);
  }

  public async isUserProtected(user: string): Promise<boolean> {
    try {
      return await this.registryContract.isProtected(user);
    } catch {
      return false;
    }
  }

  /**
   * Executes autonomous on-chain defense against a confirmed threat.
   */
  public async dispatchDefense(
    signal: ThreatSignal,
    evaluation: ThreatEvaluation
  ): Promise<DefenseDispatchResult> {
    const startTime = Date.now();
    console.log(`\n[SENTINEL] [SENTINEL DISPATCHER] Initiating closed-loop defense for victim: ${signal.targetVictim}`);
    console.log(`   [ALERT] Threat Score: ${evaluation.threatScore}/100 (${evaluation.severity})`);
    console.log(`   [EXEC] Action: ${evaluation.recommendedAction}`);

    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice ? (feeData.gasPrice * 135n) / 100n : undefined; // 1.35x Priority Escalation

      let tx: ethers.ContractTransactionResponse;

      if (evaluation.recommendedAction === "TRIGGER_EMERGENCY_SWEEP") {
        console.log(`   [SWEEP] Dispatching executeEmergencySweep to Portaldot EVM...`);
        tx = await this.executorContract.executeEmergencySweep(
          signal.targetVictim,
          [signal.tokenAddress],
          { gasPrice }
        );
      } else {
        console.log(`   [BLOCK] Dispatching executeEmergencyBatchRevoke to Portaldot EVM...`);
        tx = await this.executorContract.executeEmergencyBatchRevoke(
          signal.targetVictim,
          [signal.tokenAddress],
          [signal.sourceAddress],
          { gasPrice }
        );
      }

      console.log(`   [PENDING] Transaction broadcasted: ${tx.hash}`);
      const receipt = await tx.wait();
      const latencyMs = Date.now() - startTime;

      console.log(`   [OK] DEFENSE CONFIRMED in Block #${receipt?.blockNumber} (${latencyMs}ms)!`);
      console.log(`   [RPC] Explorer: ${CONFIG.network.nodeExplorerUrl}`);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        latencyMs,
        actionExecuted: evaluation.recommendedAction
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      console.error(`   [ERROR] Defense execution failed:`, error?.message || error);
      return {
        success: false,
        txHash: "",
        blockNumber: 0,
        latencyMs,
        actionExecuted: "FAILED"
      };
    }
  }
}
