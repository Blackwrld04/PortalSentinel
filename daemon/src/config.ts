import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

function fail(message: string): never {
  throw new Error(`[CONFIG] ${message}`);
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

function readUrl(name: string, fallback: string): string {
  const raw = process.env[name]?.trim() || fallback;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      fail(`${name} must be an http(s) URL, got "${raw}"`);
    }
  } catch {
    fail(`${name} is not a valid URL: "${raw}"`);
  }
  return raw;
}

function readAddress(name: string, fallback: string): string {
  const raw = process.env[name]?.trim() || fallback;
  if (!ethers.isAddress(raw)) {
    fail(`${name} is not a valid EVM address: "${raw}"`);
  }
  // Normalize to checksum form so logs and ABI calls are consistent.
  return ethers.getAddress(raw);
}

function readPrivateKey(): string {
  const raw = process.env.GUARDIAN_PRIVATE_KEY?.trim() || "";
  if (!raw) return "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    fail("GUARDIAN_PRIVATE_KEY must be a 32-byte hex string (0x + 64 hex chars)");
  }
  return raw;
}

function readRpcUrls(primary: string): string[] {
  const raw = process.env.PORTALDOT_RPC_URLS?.trim();
  const urls = raw
    ? raw.split(",").map((value) => value.trim()).filter(Boolean)
    : [primary];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        fail(`PORTALDOT_RPC_URLS contains a non-http(s) URL: "${url}"`);
      }
    } catch {
      fail(`PORTALDOT_RPC_URLS contains an invalid URL: "${url}"`);
    }
  }
  return [...new Set(urls)];
}

const rpcUrl = readUrl(
  "PORTALDOT_RPC_URL",
  "https://test-evm-rpc-v3.portaldot.dev"
);

// Broadcasting is opt-in: a missing/blank DRY_RUN keeps the daemon in simulation mode.
const dryRun = process.env.DRY_RUN !== "false";

export const CONFIG = {
  // Portaldot V3 Network Config
  network: {
    name: "Portaldot V3 Testnet",
    chainId: readInt("PORTALDOT_CHAIN_ID", 420420777),
    rpcUrl,
    rpcUrls: readRpcUrls(rpcUrl),
    nodeExplorerUrl:
      process.env.PORTALDOT_EXPLORER_URL?.trim() ||
      "https://node-console.portaldot.dev/",
    blockTimeMs: readInt("PORTALDOT_BLOCK_TIME_MS", 1000),
    requestTimeoutMs: readInt("PORTALDOT_REQUEST_TIMEOUT_MS", 10000),
    logRangeBlocks: readInt("PORTALDOT_LOG_RANGE_BLOCKS", 500),
  },

  // Deployed contract addresses on Portaldot Testnet (can be overridden via env)
  contracts: {
    registry: readAddress(
      "SENTINEL_REGISTRY_ADDRESS",
      "0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF"
    ),
    executor: readAddress(
      "DEFENSE_EXECUTOR_ADDRESS",
      "0x89c9510c4b3AeEE8792De383D251ef0b61d406E2"
    ),
    mockToken: readAddress(
      "MOCK_TOKEN_ADDRESS",
      "0x25da2DeD5b0Da07C160e021e0Df636988C3657f5"
    ),
    mockExploit: readAddress(
      "MOCK_EXPLOIT_ADDRESS",
      "0xc44a87FE907E497E50ffF6913c0b863bd0758a90"
    ),
  },

  // Guardian bot operator key. Empty in dry-run mode; dispatcher refuses to start otherwise.
  guardian: {
    privateKey: readPrivateKey(),
    gasPriorityMultiplier: 1.35,
    dryRun,
    maxAttempts: readInt("DEFENSE_MAX_ATTEMPTS", 3),
    receiptTimeoutMs: readInt("DEFENSE_RECEIPT_TIMEOUT_MS", 60000),
  },

  // Threat sensitivity thresholds (must agree with SentinelRegistry.DefenseMode)
  thresholds: {
    conservative: 80,
    balanced: 60,
    aggressive: 40,
  },

  // Telegram alerting config
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || "",
    chatId: process.env.TELEGRAM_CHAT_ID?.trim() || "",
    enabled: process.env.TELEGRAM_ALERTS_ENABLED !== "false",
  },

  // Observability
  metrics: {
    port: readInt("METRICS_PORT", 3001),
    host: process.env.METRICS_HOST?.trim() || "127.0.0.1",
    corsOrigin: process.env.CORS_ORIGIN?.trim() || "http://localhost:3002",
  },
} as const;

export function assertCanSign(): void {
  if (!CONFIG.guardian.dryRun && !CONFIG.guardian.privateKey) {
    fail(
      "GUARDIAN_PRIVATE_KEY is required to broadcast defense transactions. " +
        "Set DRY_RUN=true for a no-broadcast simulation."
    );
  }
}
