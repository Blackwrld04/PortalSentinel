import { CONFIG } from "./config.js";
import { ThreatEvaluation, ThreatSignal } from "./threatScorer.js";
import { DefenseDispatchResult } from "./dispatcher.js";

export interface TelegramMessageOptions {
  chatId?: string;
  parseMode?: "HTML" | "MarkdownV2" | "Markdown";
  disableWebPagePreview?: boolean;
}

export class TelegramNotifier {
  private botToken: string;
  private defaultChatId: string;
  private isEnabled: boolean;

  constructor() {
    this.botToken = (CONFIG as any).telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN || "";
    this.defaultChatId = (CONFIG as any).telegram?.chatId || process.env.TELEGRAM_CHAT_ID || "";
    this.isEnabled = (CONFIG as any).telegram?.enabled !== false && process.env.TELEGRAM_ALERTS_ENABLED !== "false";
  }

  /**
   * Send a general text message via Telegram Bot API or mock log
   */
  public async sendMessage(text: string, options?: TelegramMessageOptions): Promise<boolean> {
    const chatId = options?.chatId || this.defaultChatId;

    if (!this.isEnabled) {
      console.log(`[TELEGRAM] Alerts are disabled in config.`);
      return false;
    }

    if (!this.botToken || !chatId) {
      console.log(`\n[TELEGRAM ALERT SIMULATED — NO TOKEN/CHAT_ID IN .ENV]`);
      console.log(`------------------------------------------------------------`);
      console.log(text.replace(/<[^>]*>?/gm, "")); // Strip HTML tags for clean terminal output
      console.log(`------------------------------------------------------------`);
      console.log(`[CONFIG] To send real Telegram alerts to your mobile phone:`);
      console.log(`   1. Create a bot with @BotFather and copy token to .env: TELEGRAM_BOT_TOKEN=...`);
      console.log(`   2. Get your Chat ID from @userinfobot and add: TELEGRAM_CHAT_ID=...`);
      return true;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode || "HTML",
        disable_web_page_preview: options?.disableWebPagePreview ?? true,
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.ok) {
        console.log(`[TELEGRAM] Alert sent successfully to chat ID: ${chatId}`);
        return true;
      } else {
        console.warn(`[TELEGRAM API ERROR]:`, data.description);
        return false;
      }
    } catch (err: any) {
      console.error(`[TELEGRAM ERROR]: Failed to send notification:`, err?.message || err);
      return false;
    }
  }

  /**
   * Alert dispatched when an inbound threat / malicious drain is detected in a block
   */
  public async sendThreatDetectedAlert(
    signal: ThreatSignal,
    evaluation: ThreatEvaluation,
    customChatId?: string
  ): Promise<boolean> {
    const severityBadge =
      evaluation.threatScore >= 80 ? "<b>[CRITICAL THREAT DETECTED]</b>" :
      evaluation.threatScore >= 60 ? "<b>[HIGH THREAT DETECTED]</b>" : "<b>[SUSPICIOUS ACTIVITY]</b>";
    const simulationBadge = signal.simulated ? "[SIMULATION] " : "";

    const message = [
      `${simulationBadge}${severityBadge} — <b>PortalSentinel Defense</b>`,
      ``,
      `<b>Victim Vault:</b> <code>${signal.targetVictim}</code>`,
      `<b>Attacker:</b> <code>${signal.sourceAddress}</code>`,
      `<b>Approved Spender:</b> <code>${signal.spenderAddress}</code>`,
      `<b>Target Asset:</b> <code>${signal.tokenAddress}</code>`,
      `<b>Threat Risk Score:</b> <b>${evaluation.threatScore}/100</b> [${evaluation.severity}]`,
      `<b>Block Detected:</b> #${signal.blockNumber}`,
      `<b>Action Decided:</b> <code>${evaluation.recommendedAction}</code>`,
      ``,
      `<b>Risk Indicators:</b>`,
      ...evaluation.reasons.map((r) => ` • ${r}`),
      ``,
      signal.simulated
        ? `<i>Simulation only — no transaction was broadcast.</i>`
        : `<i>PortalSentinel is autonomously dispatching a defense transaction on Portaldot V3 EVM...</i>`
    ].join("\n");

    return this.sendMessage(message, { chatId: customChatId, parseMode: "HTML" });
  }

  /**
   * Alert dispatched when PortalSentinel successfully executes an autonomous defense
   */
  public async sendDefenseExecutedAlert(
    result: DefenseDispatchResult,
    signal: ThreatSignal,
    evaluation: ThreatEvaluation,
    customChatId?: string
  ): Promise<boolean> {
    const isSuccess = result.success;
    const isSimulated = result.simulated;
    const header = isSuccess
      ? isSimulated
        ? `<b>[DRY RUN — DEFENSE SIMULATED]</b>`
        : `<b>[DEFENSE CONFIRMED ON-CHAIN]</b>`
      : `<b>[DEFENSE WARNING — ACTION FAILED]</b>`;

    const statusLine = isSuccess
      ? isSimulated
        ? `<b>Simulated Latency:</b> <b>${result.latencyMs} ms</b> (simulation only)`
        : `<b>Defense Latency:</b> <b>${result.latencyMs} ms</b> (confirmed on-chain)`
      : `<b>Failure Reason:</b> <code>${result.error || "unknown"}</code>`;

    const message = [
      `${header}`,
      ``,
      `<b>Victim Address:</b> <code>${signal.targetVictim}</code>`,
      `<b>Defense Action:</b> <code>${result.actionExecuted}</code>`,
      statusLine,
      `<b>Attempts:</b> ${result.attempts}`,
      `<b>Mined in Block:</b> #${result.blockNumber}`,
      result.txHash ? `<b>Tx Hash:</b> <code>${result.txHash}</code>` : `<b>Tx Hash:</b> not broadcast`,
      ``,
      result.txHash
        ? `<a href="${CONFIG.network.nodeExplorerUrl}">View on Portaldot Node Console</a>`
        : ``,
      ``,
      isSimulated
        ? `<i>Dry-run mode: no transaction was broadcast.</i>`
        : isSuccess
          ? `<i>The configured defense was confirmed on-chain. Verify the transaction before assuming the incident is fully resolved.</i>`
          : `<i>Automatic defense failed. Manual intervention may be required.</i>`,
    ].join("\n");

    return this.sendMessage(message, { chatId: customChatId, parseMode: "HTML" });
  }

  /**
   * Send a test ping verification message to the user
   */
  public async sendTestPing(chatId?: string): Promise<boolean> {
    const message = [
      `<b>[PORTALSENTINEL BOT — TEST NOTIFICATION]</b>`,
      ``,
      `<b>Connection Status:</b> ACTIVE & ARMED`,
      `<b>Network:</b> ${CONFIG.network.name} (Chain ID: ${CONFIG.network.chainId})`,
      `<b>Engine:</b> pallet-revive RISC-V PolkaVM Circuit Breaker`,
      ``,
      `<i>You will receive a Telegram push notification when the daemon detects the configured signal on your enrolled wallets. You do NOT need to keep the web application open.</i>`
    ].join("\n");

    return this.sendMessage(message, { chatId, parseMode: "HTML" });
  }
}

export const telegramNotifier = new TelegramNotifier();
