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
   * Alert dispatched when an inbound threat / malicious drain is detected in mempool
   */
  public async sendThreatDetectedAlert(
    signal: ThreatSignal,
    evaluation: ThreatEvaluation,
    customChatId?: string
  ): Promise<boolean> {
    const severityBadge =
      evaluation.threatScore >= 80 ? "<b>[CRITICAL THREAT DETECTED]</b>" :
      evaluation.threatScore >= 60 ? "<b>[HIGH THREAT DETECTED]</b>" : "<b>[SUSPICIOUS ACTIVITY]</b>";

    const message = [
      `${severityBadge} — <b>PortalSentinel Defense</b>`,
      ``,
      `<b>Victim Vault:</b> <code>${signal.targetVictim}</code>`,
      `<b>Attacker/Spender:</b> <code>${signal.sourceAddress}</code>`,
      `<b>Target Asset:</b> <code>${signal.tokenAddress}</code>`,
      `<b>Threat Risk Score:</b> <b>${evaluation.threatScore}/100</b> [${evaluation.severity}]`,
      `<b>Block Detected:</b> #${signal.blockNumber}`,
      `<b>Action Decided:</b> <code>${evaluation.recommendedAction}</code>`,
      ``,
      `<b>Risk Indicators:</b>`,
      ...evaluation.reasons.map((r) => ` • ${r}`),
      ``,
      `<i>PortalSentinel is autonomously dispatching front-run transaction on Portaldot V3 EVM...</i>`
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
    const header = isSuccess
      ? `<b>[EXPLOIT NEUTRALIZED — CAPITAL PRESERVED]</b>`
      : `<b>[DEFENSE WARNING — ACTION FAILED]</b>`;

    const message = [
      `${header}`,
      ``,
      `<b>Victim Address:</b> <code>${signal.targetVictim}</code>`,
      `<b>Defense Action:</b> <code>${result.actionExecuted}</code>`,
      `<b>Preemption Latency:</b> <b>${result.latencyMs} ms</b> (Front-Ran Attacker)`,
      `<b>Mined in Block:</b> #${result.blockNumber}`,
      `<b>Tx Hash:</b> <code>${result.txHash}</code>`,
      ``,
      `<a href="${CONFIG.network.nodeExplorerUrl}">View on Portaldot Node Console</a>`,
      ``,
      `<i>Your funds have been protected by PortalSentinel's autonomous circuit breaker. No further action is required.</i>`
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
      `<i>You will receive instant push notifications whenever suspicious approvals or mempool drain transactions target your enrolled wallets. You do NOT need to keep the web application open!</i>`
    ].join("\n");

    return this.sendMessage(message, { chatId, parseMode: "HTML" });
  }
}

export const telegramNotifier = new TelegramNotifier();
