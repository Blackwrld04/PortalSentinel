import http from "node:http";
import { CONFIG } from "./config.js";

export interface SentinelMetricsState {
  blockHeight: number;
  rpcLatencyMs: number;
  threatsDetected: number;
  defensesExecuted: number;
  defensesSimulated: number;
  defensesFailed: number;
  alertsSent: number;
  lastDefenseLatencyMs: number;
  uptimeStart: number;
  isArmed: boolean;
  activeShieldedUsers: number;
}

export class MetricsServer {
  private state: SentinelMetricsState = {
    blockHeight: 0,
    rpcLatencyMs: 0,
    threatsDetected: 0,
    defensesExecuted: 0,
    defensesSimulated: 0,
    defensesFailed: 0,
    alertsSent: 0,
    lastDefenseLatencyMs: 0,
    uptimeStart: Date.now(),
    isArmed: !CONFIG.guardian.dryRun,
    activeShieldedUsers: 0,
  };

  private server: http.Server | null = null;
  private port: number;
  private host: string;

  constructor(port = CONFIG.metrics.port, host = CONFIG.metrics.host) {
    this.port = port;
    this.host = host;
  }

  public updateMetric<K extends keyof SentinelMetricsState>(key: K, value: SentinelMetricsState[K]) {
    this.state[key] = value;
  }

  public incrementMetric(
    key:
      | "threatsDetected"
      | "defensesExecuted"
      | "defensesSimulated"
      | "defensesFailed"
      | "alertsSent"
  ) {
    this.state[key]++;
  }

  public start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        // Restrict CORS to the dashboard origin instead of every origin.
        res.setHeader("Access-Control-Allow-Origin", CONFIG.metrics.corsOrigin);
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = req.url?.split("?")[0] || "/";

        if (url === "/health" || url === "/api/status" || url === "/") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify(
              {
                status: "healthy",
                network: CONFIG.network.name,
                chainId: CONFIG.network.chainId,
                rpcUrl: CONFIG.network.rpcUrl,
                engine: "pallet-revive PolkaVM Circuit Breaker",
                metrics: {
                  ...this.state,
                  uptimeSeconds: Math.floor((Date.now() - this.state.uptimeStart) / 1000),
                },
                contracts: CONFIG.contracts,
                telegramEnabled: CONFIG.telegram.enabled,
                dryRun: CONFIG.guardian.dryRun,
              },
              null,
              2
            )
          );
          return;
        }

        if (url === "/metrics") {
          const uptimeSec = Math.floor((Date.now() - this.state.uptimeStart) / 1000);
          const promData = [
            `# HELP sentinel_monitored_block_height Latest block height monitored on Portaldot V3`,
            `# TYPE sentinel_monitored_block_height gauge`,
            `sentinel_monitored_block_height ${this.state.blockHeight}`,
            ``,
            `# HELP sentinel_rpc_latency_ms RPC roundtrip latency in milliseconds`,
            `# TYPE sentinel_rpc_latency_ms gauge`,
            `sentinel_rpc_latency_ms ${this.state.rpcLatencyMs}`,
            ``,
            `# HELP sentinel_threats_detected_total Total suspicious transaction events detected`,
            `# TYPE sentinel_threats_detected_total counter`,
            `sentinel_threats_detected_total ${this.state.threatsDetected}`,
            ``,
            `# HELP sentinel_defenses_executed_total Total autonomous defenses confirmed on-chain`,
            `# TYPE sentinel_defenses_executed_total counter`,
            `sentinel_defenses_executed_total ${this.state.defensesExecuted}`,
            ``,
            `# HELP sentinel_defenses_simulated_total Total defenses selected but not broadcast (dry run)`,
            `# TYPE sentinel_defenses_simulated_total counter`,
            `sentinel_defenses_simulated_total ${this.state.defensesSimulated}`,
            ``,
            `# HELP sentinel_defenses_failed_total Total autonomous defenses that failed`,
            `# TYPE sentinel_defenses_failed_total counter`,
            `sentinel_defenses_failed_total ${this.state.defensesFailed}`,
            ``,
            `# HELP sentinel_defense_latency_ms Latency of most recent defense action in ms`,
            `# TYPE sentinel_defense_latency_ms gauge`,
            `sentinel_defense_latency_ms ${this.state.lastDefenseLatencyMs}`,
            ``,
            `# HELP sentinel_telegram_alerts_sent_total Total alerts dispatched to Telegram`,
            `# TYPE sentinel_telegram_alerts_sent_total counter`,
            `sentinel_telegram_alerts_sent_total ${this.state.alertsSent}`,
            ``,
            `# HELP sentinel_dry_run 1 when the daemon is in dry-run mode, 0 when live`,
            `# TYPE sentinel_dry_run gauge`,
            `sentinel_dry_run ${CONFIG.guardian.dryRun ? 1 : 0}`,
            ``,
            `# HELP sentinel_uptime_seconds Total daemon uptime in seconds`,
            `# TYPE sentinel_uptime_seconds counter`,
            `sentinel_uptime_seconds ${uptimeSec}`,
            ``,
            `# HELP sentinel_active_shielded_users Count of enrolled protected vaults`,
            `# TYPE sentinel_active_shielded_users gauge`,
            `sentinel_active_shielded_users ${this.state.activeShieldedUsers}`,
            ``,
          ].join("\n");

          res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
          res.end(promData);
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Endpoint not found" }));
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`📊 [METRICS SERVER] Telemetry & Prometheus API listening on http://${this.host}:${this.port}`);
        console.log(`   • Health Endpoint:     http://${this.host}:${this.port}/health`);
        console.log(`   • Prometheus Metrics:  http://${this.host}:${this.port}/metrics`);
        resolve(this.port);
      });
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

export const metricsServer = new MetricsServer();
