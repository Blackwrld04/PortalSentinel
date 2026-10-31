import http from "node:http";
import { CONFIG } from "./config.js";

export interface SentinelMetricsState {
  blockHeight: number;
  rpcLatencyMs: number;
  threatsDetected: number;
  defensesExecuted: number;
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
    alertsSent: 0,
    lastDefenseLatencyMs: 14,
    uptimeStart: Date.now(),
    isArmed: true,
    activeShieldedUsers: 1,
  };

  private server: http.Server | null = null;
  private port: number;

  constructor(port = Number(process.env.METRICS_PORT) || 3001) {
    this.port = port;
  }

  public updateMetric<K extends keyof SentinelMetricsState>(key: K, value: SentinelMetricsState[K]) {
    this.state[key] = value;
  }

  public incrementMetric(key: "threatsDetected" | "defensesExecuted" | "alertsSent") {
    this.state[key]++;
  }

  public start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        // Enable CORS for frontend dashboard queries
        res.setHeader("Access-Control-Allow-Origin", "*");
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
            `# HELP sentinel_defenses_executed_total Total autonomous front-run defenses executed`,
            `# TYPE sentinel_defenses_executed_total counter`,
            `sentinel_defenses_executed_total ${this.state.defensesExecuted}`,
            ``,
            `# HELP sentinel_preemption_latency_ms Latency of most recent defense action in ms`,
            `# TYPE sentinel_preemption_latency_ms gauge`,
            `sentinel_preemption_latency_ms ${this.state.lastDefenseLatencyMs}`,
            ``,
            `# HELP sentinel_telegram_alerts_sent_total Total alerts dispatched to Telegram`,
            `# TYPE sentinel_telegram_alerts_sent_total counter`,
            `sentinel_telegram_alerts_sent_total ${this.state.alertsSent}`,
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

      this.server.listen(this.port, () => {
        console.log(`📊 [METRICS SERVER] Telemetry & Prometheus API listening on http://localhost:${this.port}`);
        console.log(`   • Health Endpoint:     http://localhost:${this.port}/health`);
        console.log(`   • Prometheus Metrics:  http://localhost:${this.port}/metrics`);
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
