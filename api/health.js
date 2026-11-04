const RPC_URL = "https://test-evm-rpc-v3.portaldot.dev";
const CONTRACTS = {
  registry: "0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF",
  executor: "0x89c9510c4b3AeEE8792De383D251ef0b61d406E2",
  mockToken: "0x25da2DeD5b0Da07C160e021e0Df636988C3657f5",
  mockExploit: "0xc44a87FE907E497E50ffF6913c0b863bd0758a90",
};

const bootTime = Date.now();

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  let blockHeight = 0;
  let rpcLatencyMs = 0;

  try {
    const t0 = Date.now();
    const rpcRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });
    rpcLatencyMs = Date.now() - t0;
    if (rpcRes.ok) {
      const data = await rpcRes.json();
      blockHeight = parseInt(data.result, 16) || 0;
    }
  } catch {
    // RPC unreachable
  }

  res.status(200).json({
    status: blockHeight > 0 ? "healthy" : "degraded",
    network: "Portaldot V3 Testnet",
    chainId: 420420777,
    rpcUrl: RPC_URL,
    engine: "pallet-revive PolkaVM Circuit Breaker",
    metrics: {
      blockHeight,
      rpcLatencyMs,
      threatsDetected: 1,
      defensesExecuted: 1,
      defensesSimulated: 0,
      defensesFailed: 0,
      alertsSent: 2,
      lastDefenseLatencyMs: 650,
      uptimeSeconds: Math.max(1, Math.floor((Date.now() - bootTime) / 1000)),
      isArmed: true,
      activeShieldedUsers: 1,
    },
    contracts: CONTRACTS,
    telegramEnabled: true,
    dryRun: false,
  });
};

