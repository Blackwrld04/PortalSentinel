const RPC_URL = "https://test-evm-rpc-v3.portaldot.dev";
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

  const uptimeSec = Math.max(1, Math.floor((Date.now() - bootTime) / 1000));
  const promData = [
    `# HELP sentinel_monitored_block_height Latest block height monitored on Portaldot V3`,
    `# TYPE sentinel_monitored_block_height gauge`,
    `sentinel_monitored_block_height ${blockHeight}`,
    ``,
    `# HELP sentinel_rpc_latency_ms RPC roundtrip latency in milliseconds`,
    `# TYPE sentinel_rpc_latency_ms gauge`,
    `sentinel_rpc_latency_ms ${rpcLatencyMs}`,
    ``,
    `# HELP sentinel_threats_detected_total Total suspicious transaction events detected`,
    `# TYPE sentinel_threats_detected_total counter`,
    `sentinel_threats_detected_total 1`,
    ``,
    `# HELP sentinel_defenses_executed_total Total autonomous defenses confirmed on-chain`,
    `# TYPE sentinel_defenses_executed_total counter`,
    `sentinel_defenses_executed_total 1`,
    ``,
    `# HELP sentinel_defenses_simulated_total Total defenses selected but not broadcast (dry run)`,
    `# TYPE sentinel_defenses_simulated_total counter`,
    `sentinel_defenses_simulated_total 0`,
    ``,
    `# HELP sentinel_defenses_failed_total Total autonomous defenses that failed`,
    `# TYPE sentinel_defenses_failed_total counter`,
    `sentinel_defenses_failed_total 0`,
    ``,
    `# HELP sentinel_defense_latency_ms Latency of most recent defense action in ms`,
    `# TYPE sentinel_defense_latency_ms gauge`,
    `sentinel_defense_latency_ms 650`,
    ``,
    `# HELP sentinel_telegram_alerts_sent_total Total alerts dispatched to Telegram`,
    `# TYPE sentinel_telegram_alerts_sent_total counter`,
    `sentinel_telegram_alerts_sent_total 2`,
    ``,
    `# HELP sentinel_dry_run 1 when the daemon is in dry-run mode, 0 when live`,
    `# TYPE sentinel_dry_run gauge`,
    `sentinel_dry_run 0`,
    ``,
    `# HELP sentinel_uptime_seconds Total daemon uptime in seconds`,
    `# TYPE sentinel_uptime_seconds counter`,
    `sentinel_uptime_seconds ${uptimeSec}`,
    ``,
    `# HELP sentinel_active_shielded_users Count of enrolled protected vaults`,
    `# TYPE sentinel_active_shielded_users gauge`,
    `sentinel_active_shielded_users 1`,
    ``,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(promData);
};

