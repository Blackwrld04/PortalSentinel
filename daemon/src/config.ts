import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  // Portaldot V3 Network Config
  network: {
    name: "Portaldot V3 Testnet",
    chainId: 420420777,
    rpcUrl: process.env.PORTALDOT_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev",
    nodeExplorerUrl: "https://node-console.portaldot.dev/",
    blockTimeMs: 1000
  },

  // Deployed Contract Addresses on Portaldot Testnet (can be overridden via env)
  contracts: {
    registry: process.env.SENTINEL_REGISTRY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    executor: process.env.DEFENSE_EXECUTOR_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    mockToken: process.env.MOCK_TOKEN_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    mockExploit: process.env.MOCK_EXPLOIT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  },

  // Guardian Bot Operator Key
  guardian: {
    privateKey: process.env.GUARDIAN_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    gasPriorityMultiplier: 1.35
  },

  // Threat Sensitivity Thresholds
  thresholds: {
    conservative: 80,
    balanced: 60,
    aggressive: 40
  },

  // Telegram Alerting Config
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
    enabled: process.env.TELEGRAM_ALERTS_ENABLED !== "false"
  }
};
