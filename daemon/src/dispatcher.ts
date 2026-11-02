import dns from "node:dns";
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { ethers } from "ethers";
import { CONFIG, assertCanSign } from "./config.js";
import { DefenseAction, selectDefenseAction } from "./defensePlan.js";
import { ThreatEvaluation, ThreatSignal } from "./threatScorer.js";

// Minimal ABIs
const EXECUTOR_ABI = [
  "function executeEmergencyBatchRevoke(address user, address[] calldata tokens, address[] calldata spenders, uint256 threatScore) external",
  "function executeEmergencySweep(address user, address[] calldata tokens, uint256 threatScore) external",
  "function registry() external view returns (address)",
  "event EmergencyRevokeExecuted(address indexed user, address indexed token, address indexed spender, address operator, uint256 timestamp)",
  "event EmergencyRevokeFailed(address indexed user, address indexed token, address indexed spender, string reason)",
  "event EmergencySweepExecuted(address indexed user, address indexed token, address indexed emergencySafe, uint256 amountRescued, uint256 timestamp)",
  "event ThreatNeutralized(address indexed user, address indexed threatSpender, uint256 threatScore, string actionTaken)",
];

const REGISTRY_ABI = [
  "function isProtected(address user) external view returns (bool)",
  "function getUserPolicy(address user) external view returns (tuple(bool isActive, uint8 mode, address emergencySafe, uint256 registeredTimestamp, uint256 lastDefenseActionTimestamp))",
  "function paused() external view returns (bool)",
  "function authorizedGuardians(address guardian) external view returns (bool)",
  "function owner() external view returns (address)",
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
];

const ZERO_TX_HASH = "";

export interface UserPolicy {
  isActive: boolean;
  mode: number;
  emergencySafe: string;
}

export interface DefenseDispatchResult {
  success: boolean;
  simulated: boolean;
  duplicate: boolean;
  txHash: string;
  blockNumber: number;
  latencyMs: number;
  actionExecuted: string;
  attempts: number;
  error?: string;
}

export class DefenseDispatcher {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.NonceManager;
  private executorContract: ethers.Contract;
  private registryContract: ethers.Contract;
  private walletAddress: string;

  /** In-flight guards so a repeated signal cannot double-send the same defense. */
  private inFlight = new Set<string>();

  constructor() {
    assertCanSign();

    const staticNet = new ethers.Network(
      CONFIG.network.name,
      CONFIG.network.chainId
    );
    const req = new ethers.FetchRequest(CONFIG.network.rpcUrl);
    req.timeout = CONFIG.network.requestTimeoutMs;
    this.provider = new ethers.JsonRpcProvider(req, staticNet, {
      staticNetwork: staticNet,
    });

    // A dry-run daemon must not require a real key. The random wallet never signs.
    const baseWallet = CONFIG.guardian.privateKey
      ? new ethers.Wallet(CONFIG.guardian.privateKey, this.provider)
      : ethers.Wallet.createRandom(this.provider);
    this.walletAddress = baseWallet.address;

    // NonceManager prevents concurrent defense transactions from colliding.
    this.signer = new ethers.NonceManager(baseWallet);
    this.executorContract = new ethers.Contract(
      CONFIG.contracts.executor,
      EXECUTOR_ABI,
      this.signer
    );
    this.registryContract = new ethers.Contract(
      CONFIG.contracts.registry,
      REGISTRY_ABI,
      this.provider
    );
  }

  /**
   * Fails fast on a misconfigured live deployment: the executor must point at the
   * configured registry, the registry must be unpaused, and the signer must be an
   * authorized guardian (or the registry owner). Dry runs skip the signer check.
   */
  public async verifyConfiguration(): Promise<void> {
    let linkedRegistry: string;
    try {
      linkedRegistry = await this.executorContract.registry();
    } catch (error: any) {
      const message = error?.shortMessage || error?.message || String(error);
      if (!CONFIG.guardian.dryRun) {
        throw new Error(
          `Cannot read DefenseExecutor.registry() at ${CONFIG.contracts.executor}: ${message}. ` +
            `Check DEFENSE_EXECUTOR_ADDRESS and the RPC.`
        );
      }
      console.warn(
        `[SENTINEL] Could not verify executor linkage in dry run: ${message}`
      );
      return;
    }

    if (ethers.getAddress(linkedRegistry) !== CONFIG.contracts.registry) {
      throw new Error(
        `DefenseExecutor ${CONFIG.contracts.executor} is linked to registry ` +
          `${linkedRegistry}, but SENTINEL_REGISTRY_ADDRESS is ${CONFIG.contracts.registry}.`
      );
    }

    if (CONFIG.guardian.dryRun) {
      console.log(
        `[SENTINEL] Executor/registry linkage verified (dry run: signer authorization not checked).`
      );
      return;
    }

    const [paused, authorized, owner] = await Promise.all([
      this.registryContract.paused(),
      this.registryContract.authorizedGuardians(this.walletAddress),
      this.registryContract.owner(),
    ]);

    if (paused) {
      throw new Error(
        "SentinelRegistry is paused; autonomous defense would revert. " +
          "Unpause it or run with DRY_RUN=true."
      );
    }
    if (!authorized && ethers.getAddress(owner) !== this.walletAddress) {
      throw new Error(
        `Guardian ${this.walletAddress} is not authorized in SentinelRegistry ` +
          `and is not its owner. Authorize the key on-chain or use the owner key.`
      );
    }

    console.log(
      `[SENTINEL] Guardian ${this.walletAddress} authorized; registry active.`
    );
  }

  public async isUserProtected(user: string): Promise<boolean> {
    try {
      return await this.registryContract.isProtected(user);
    } catch {
      return false;
    }
  }

  public async getUserPolicy(user: string): Promise<UserPolicy | null> {
    try {
      const policy = await this.registryContract.getUserPolicy(user);
      return {
        isActive: Boolean(policy.isActive),
        mode: Number(policy.mode),
        emergencySafe: String(policy.emergencySafe),
      };
    } catch {
      return null;
    }
  }

  /**
   * Executes an autonomous on-chain defense against a confirmed threat.
   *
   * Retries only before a transaction is broadcast. Once a transaction hash exists,
   * the method waits for a receipt and never re-sends under a new nonce, because a
   * timeout does not prove the first transaction will not mine.
   */
  public async dispatchDefense(
    signal: ThreatSignal,
    evaluation: ThreatEvaluation
  ): Promise<DefenseDispatchResult> {
    const startTime = Date.now();
    const requestedAction = evaluation.recommendedAction;

    if (
      requestedAction !== "TRIGGER_EMERGENCY_REVOKE" &&
      requestedAction !== "TRIGGER_EMERGENCY_SWEEP"
    ) {
      return {
        success: true,
        simulated: true,
        duplicate: false,
        txHash: ZERO_TX_HASH,
        blockNumber: 0,
        latencyMs: Date.now() - startTime,
        actionExecuted: "NO_ACTION",
        attempts: 0,
      };
    }

    // The scorer can recommend a sweep, but a sweep is only executable when the
    // victim has approved the executor and still holds a balance. Otherwise fall
    // back to revoking the dangerous allowance instead of sending a reverting tx.
    const [executorAllowance, spenderAllowance, balance] = await Promise.all([
      this.readUint(
        "allowance",
        signal.tokenAddress,
        signal.targetVictim,
        CONFIG.contracts.executor
      ),
      this.readUint(
        "allowance",
        signal.tokenAddress,
        signal.targetVictim,
        signal.spenderAddress
      ),
      this.readUint("balanceOf", signal.tokenAddress, signal.targetVictim),
    ]);
    const selection = selectDefenseAction(requestedAction, {
      executorAllowance,
      spenderAllowance,
      balance,
    });
    if (!selection.action) {
      const reason = selection.reason || "No executable defense available";
      console.error(`[SENTINEL] Preflight refused ${requestedAction}: ${reason}`);
      return {
        success: false,
        simulated: false,
        duplicate: false,
        txHash: ZERO_TX_HASH,
        blockNumber: 0,
        latencyMs: Date.now() - startTime,
        actionExecuted: "NO_ACTION",
        attempts: 0,
        error: reason,
      };
    }
    const action = selection.action;
    if (selection.fellBack) {
      console.log(
        `[SENTINEL] ${requestedAction} is not executable; using ${action} instead.`
      );
    }

    const idempotencyKey = [
      signal.txHash,
      signal.targetVictim,
      signal.tokenAddress,
      action,
    ].join(":");
    if (this.inFlight.has(idempotencyKey)) {
      console.log(
        `[SENTINEL] Duplicate signal suppressed for ${signal.targetVictim} (${action})`
      );
      return {
        success: true,
        simulated: false,
        duplicate: true,
        txHash: ZERO_TX_HASH,
        blockNumber: 0,
        latencyMs: Date.now() - startTime,
        actionExecuted: "DUPLICATE_SUPPRESSED",
        attempts: 0,
      };
    }

    this.inFlight.add(idempotencyKey);
    try {
      if (CONFIG.guardian.dryRun) {
        console.log(
          `[SENTINEL] DRY RUN — would dispatch ${action} for ${signal.targetVictim} ` +
            `(score ${evaluation.threatScore}/100)`
        );
        return {
          success: true,
          simulated: true,
          duplicate: false,
          txHash: ZERO_TX_HASH,
          blockNumber: 0,
          latencyMs: Date.now() - startTime,
          actionExecuted: action,
          attempts: 0,
        };
      }

      const result = await this.sendWithRetry(signal, evaluation, startTime, action);

      // A sweep moves funds but does not remove the allowance that let the
      // attacker pull them. Try to zero that residual approval as part of the
      // same incident; if the token cannot be revoked, the funds are still safe.
      if (
        result.success &&
        !result.simulated &&
        action === "TRIGGER_EMERGENCY_SWEEP" &&
        (await this.revokeResidualAllowance(signal, evaluation.threatScore))
      ) {
        result.actionExecuted = `${action}+REVOKE`;
        result.latencyMs = Date.now() - startTime;
      }

      return result;
    } finally {
      this.inFlight.delete(idempotencyKey);
    }
  }

  /**
   * Best-effort cleanup after a sweep: revoke the allowance the attacker was
   * using. Returns true only when the on-chain allowance is confirmed zero.
   */
  private async revokeResidualAllowance(
    signal: ThreatSignal,
    threatScore: number
  ): Promise<boolean> {
    const allowance = await this.readUint(
      "allowance",
      signal.tokenAddress,
      signal.targetVictim,
      signal.spenderAddress
    );
    if (allowance === null || allowance === 0n) {
      return false;
    }

    try {
      const tx = await this.executorContract.executeEmergencyBatchRevoke(
        signal.targetVictim,
        [signal.tokenAddress],
        [signal.spenderAddress],
        threatScore,
        await this.buildFeeOverrides(1)
      );
      console.log(`   [CLEANUP] Residual allowance revoke broadcast: ${tx.hash}`);
      const receipt = await tx.wait(1, CONFIG.guardian.receiptTimeoutMs);
      if (receipt) {
        console.log(
          `   [CLEANUP] Residual allowance zeroed in block #${receipt.blockNumber}`
        );
        return true;
      }
      console.warn(`   [CLEANUP] Revoke broadcast but not confirmed before timeout.`);
      return false;
    } catch (error: any) {
      const message = error?.shortMessage || error?.message || String(error);
      console.warn(
        `   [CLEANUP] Residual allowance could not be revoked: ${message}. ` +
          `Swept funds remain in the cold safe.`
      );
      return false;
    }
  }

  /**
   * Reads a token allowance/balance. Returns null when the RPC or token does not
   * answer, in which case the caller assumes the action is viable rather than
   * refusing to defend on incomplete information.
   */
  private async readUint(
    method: "allowance" | "balanceOf",
    token: string,
    owner: string,
    spender?: string
  ): Promise<bigint | null> {
    try {
      const contract = new ethers.Contract(token, ERC20_ABI, this.provider);
      if (method === "allowance") {
        return await contract.allowance(owner, spender);
      }
      return await contract.balanceOf(owner);
    } catch {
      return null;
    }
  }

  private async sendWithRetry(
    signal: ThreatSignal,
    evaluation: ThreatEvaluation,
    startTime: number,
    action: DefenseAction
  ): Promise<DefenseDispatchResult> {
    const maxAttempts = CONFIG.guardian.maxAttempts;
    let lastError = "";
    let attemptsUsed = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsUsed = attempt;
      let tx: ethers.ContractTransactionResponse | null = null;

      try {
        const overrides = await this.buildFeeOverrides(attempt);
        console.log(
          `\n[SENTINEL] [DISPATCH] Attempt ${attempt}/${maxAttempts} — ` +
            `${action} for ${signal.targetVictim}`
        );
        console.log(
          `   Threat Score: ${evaluation.threatScore}/100 (${evaluation.severity})`
        );

        if (action === "TRIGGER_EMERGENCY_SWEEP") {
          tx = await this.executorContract.executeEmergencySweep(
            signal.targetVictim,
            [signal.tokenAddress],
            evaluation.threatScore,
            overrides
          );
        } else {
          tx = await this.executorContract.executeEmergencyBatchRevoke(
            signal.targetVictim,
            [signal.tokenAddress],
            [signal.spenderAddress],
            evaluation.threatScore,
            overrides
          );
        }

        if (!tx) {
          throw new Error("Transaction was not created");
        }

        console.log(`   [PENDING] Transaction broadcast: ${tx.hash}`);

        // Wait once. A receipt timeout is not a reason to re-send under a new nonce.
        const receipt = await tx.wait(1, CONFIG.guardian.receiptTimeoutMs);
        const latencyMs = Date.now() - startTime;

        if (!receipt) {
          return {
            success: false,
            simulated: false,
            duplicate: false,
            txHash: tx.hash,
            blockNumber: 0,
            latencyMs,
            actionExecuted: action,
            attempts: attempt,
            error: "Transaction broadcast but no receipt before timeout",
          };
        }

        console.log(
          `   [OK] Defense confirmed in block #${receipt.blockNumber} (${latencyMs}ms)`
        );

        return {
          success: true,
          simulated: false,
          duplicate: false,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          latencyMs,
          actionExecuted: action,
          attempts: attempt,
        };
      } catch (error: any) {
        lastError = error?.shortMessage || error?.message || String(error);
        console.error(`   [ERROR] Attempt ${attempt} failed: ${lastError}`);

        // If a hash exists, the transaction may still mine. Do not retry with a new nonce.
        if (tx) {
          return {
            success: false,
            simulated: false,
            duplicate: false,
            txHash: tx.hash,
            blockNumber: 0,
            latencyMs: Date.now() - startTime,
            actionExecuted: action,
            attempts: attempt,
            error: lastError,
          };
        }

        // Deterministic failures (a contract revert, insufficient funds, bad nonce)
        // will not succeed on a retry. Only transient network/RPC errors are retried.
        const code = error?.code || error?.error?.code;
        const deterministic =
          code === "CALL_EXCEPTION" ||
          code === "INSUFFICIENT_FUNDS" ||
          code === "NONCE_EXPIRED" ||
          code === "REPLACEMENT_UNDERPRICED" ||
          code === "UNPREDICTABLE_GAS_LIMIT";
        if (deterministic) {
          console.error(`   [ABORT] ${code} is not retryable.`);
          break;
        }

        if (attempt < maxAttempts) {
          const delayMs = 500 * attempt;
          console.log(`   [RETRY] Backing off ${delayMs}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      success: false,
      simulated: false,
      duplicate: false,
      txHash: ZERO_TX_HASH,
      blockNumber: 0,
      latencyMs: Date.now() - startTime,
      actionExecuted: action,
      attempts: attemptsUsed,
      error: lastError,
    };
  }

  /** 1.35× base fee on the first attempt, escalating on retries. */
  private async buildFeeOverrides(attempt: number): Promise<ethers.Overrides> {
    const overrides: ethers.Overrides = {};
    try {
      const feeData = await this.provider.getFeeData();
      const multiplierBps = 135n + BigInt(Math.max(0, attempt - 1)) * 25n; // 135, 160, 185 bps

      if (
        feeData.maxFeePerGas != null &&
        feeData.maxPriorityFeePerGas != null
      ) {
        overrides.maxPriorityFeePerGas =
          (feeData.maxPriorityFeePerGas * multiplierBps) / 100n;
        overrides.maxFeePerGas = (feeData.maxFeePerGas * multiplierBps) / 100n;
      } else if (feeData.gasPrice != null) {
        overrides.gasPrice = (feeData.gasPrice * multiplierBps) / 100n;
      }
    } catch {
      // Let the provider fill fees if the RPC does not expose fee data.
    }
    return overrides;
  }
}
