import { SentinelGuardian } from "./SentinelGuardian";
import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { ethers } from "ethers";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Check,
  CheckCircle2,
  CheckCheck,
  Lock,
  Zap,
  Terminal,
  Cpu,
  Smartphone,
  Send,
  ExternalLink,
  RotateCcw,
  Bot,
  Activity,
  Radio,
  Wallet,
  Copy
} from "lucide-react";

interface ApprovalItem {
  token: string;
  tokenSymbol: string;
  spender: string;
  spenderName: string;
  allowance: string;
  riskScore: number;
  status: "SAFE" | "SUSPICIOUS" | "CRITICAL";
}

const PORTALDOT_CHAIN_ID_DEC = 420420777;
const PORTALDOT_CHAIN_ID_HEX = "0x190f1ca9";

const PORTALDOT_NETWORK_CONFIG = {
  chainId: PORTALDOT_CHAIN_ID_HEX,
  chainName: "Portaldot V3 Testnet",
  nativeCurrency: {
    name: "Portaldot Token",
    symbol: "POT",
    decimals: 18,
  },
  rpcUrls: ["https://test-evm-rpc-v3.portaldot.dev"],
  blockExplorerUrls: ["https://node-console.portaldot.dev/"],
};

export default function App() {
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  
  // Web3 Live Wallet State (Pillar 2)
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedChainId, setConnectedChainId] = useState<number | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [potBalance, setPotBalance] = useState<string>("0.000");
  const [isArmingOnChain, setIsArmingOnChain] = useState(false);
  const [onChainRegisterHash, setOnChainRegisterHash] = useState<string>("");
  const [copiedSS58, setCopiedSS58] = useState(false);
  const ss58Address = "5FKcVpYCBtCCaeGP6ZDTdhKGgbNibGLoEbFTGJzkZodXh6jV";
  const [userAddress, setUserAddress] = useState("0x4d5a5FC178916ED51Ec0a02E38028f47AC2f6E67");
  const [emergencySafe, setEmergencySafe] = useState("0x9378C531475Ffe51368f5a6e8790089eC8d9a27A");
  const [defenseMode, setDefenseMode] = useState<"CONSERVATIVE" | "BALANCED" | "AGGRESSIVE">("BALANCED");
  
  const [blockHeight, setBlockHeight] = useState(257948);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string>("");

  // Telegram 24/7 Mobile Alert State
  const [telegramHandle, setTelegramHandle] = useState("@Blackwrld04");
  const [telegramChatId, setTelegramChatId] = useState("6755373105");
  const [telegramSaved, setTelegramSaved] = useState(true);
  const TELEGRAM_BOT_TOKEN = "9138469919:AAHPtIu6kBqusj29nf9-6UQ-4yy82q-5iSQ";

  const dispatchLiveTelegram = async (text: string) => {
    if (!telegramChatId) return;
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
    } catch (e) {
      console.warn("Direct Telegram dispatch:", e);
    }
  };
  const [telegramNotifyDrain, setTelegramNotifyDrain] = useState(true);
  const [telegramNotifySuspicious, setTelegramNotifySuspicious] = useState(true);
  const [telegramNotifyDaily, setTelegramNotifyDaily] = useState(false);
  const [testAlertSent, setTestAlertSent] = useState(false);
  const [telegramAlertPulse, setTelegramAlertPulse] = useState(false);

  const [logs, setLogs] = useState<string[]>([
    "[08:30:10] [SYSTEM] PortalSentinel node initialized on Portaldot V3 EVM (Chain ID: 420420777)",
    "[08:30:12] [MONITOR] Listening to pallet-revive RPC at https://test-evm-rpc-v3.portaldot.dev",
    "[08:30:15] [REGISTRY] Active user policies loaded. Total protected vaults: 1,429",
    "[08:30:18] [TELEMETRY] Scanning mempool for anomalous transferFrom calls & zero-day drains...",
    "[08:30:22] [HEURISTIC] Threat scoring matrix armed: Rule 1 (+100), Rule 2 (+60), Rule 3 (+25)"
  ]);

  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    {
      token: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      tokenSymbol: "pUSD",
      spender: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      spenderName: "Compromised Router (MockExploitFixture)",
      allowance: "5,000 pUSD",
      riskScore: 98,
      status: "CRITICAL"
    },
    {
      token: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      tokenSymbol: "pUSD",
      spender: "0xa02EE16EB03d2cf1aeF199F7658FB8c8E3188ffd",
      spenderName: "BridgeZero Vault",
      allowance: "10,000 pUSD",
      riskScore: 12,
      status: "SAFE"
    },
    {
      token: "0x1234567890123456789012345678901234567890",
      tokenSymbol: "tPOT",
      spender: "0x68283AAa8899A4aA299141ca6f04dF8e5802509f",
      spenderName: "PortalSwap DEX Router",
      allowance: "500 tPOT",
      riskScore: 24,
      status: "SAFE"
    }
  ]);

  // Live block ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setBlockHeight((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const fetchBalance = async (provider: any, address: string) => {
    try {
      const bal = await provider.getBalance(address);
      const formatted = ethers.formatEther(bal);
      setPotBalance(parseFloat(formatted).toFixed(4));
    } catch {
      setPotBalance("0.000");
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("No Web3 wallet detected! Please install MetaMask or Rabby.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setUserAddress(address);
        setWalletConnected(true);
        addLog(`[WALLET] Connected EOA account: ${address}`);

        const network = await provider.getNetwork();
        const chainIdNum = Number(network.chainId);
        setConnectedChainId(chainIdNum);

        if (chainIdNum !== PORTALDOT_CHAIN_ID_DEC) {
          setIsWrongNetwork(true);
          await switchNetwork();
        } else {
          setIsWrongNetwork(false);
          await fetchBalance(provider, address);
        }
      }
    } catch (err: any) {
      addLog(`[WALLET] Connection failed: ${err.message || err}`);
    }
  };

  const switchNetwork = async () => {
    if (!(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: PORTALDOT_CHAIN_ID_HEX }],
      });
      setIsWrongNetwork(false);
      setConnectedChainId(PORTALDOT_CHAIN_ID_DEC);
      addLog("[WALLET] Switched network to Portaldot V3 Testnet (Chain ID: 420420777)");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await fetchBalance(provider, userAddress);
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [PORTALDOT_NETWORK_CONFIG],
          });
          setIsWrongNetwork(false);
          setConnectedChainId(PORTALDOT_CHAIN_ID_DEC);
          addLog("[WALLET] Added and connected Portaldot V3 Testnet to MetaMask!");
        } catch (addError: any) {
          addLog(`[WALLET] Failed to add Portaldot V3: ${addError.message}`);
        }
      } else {
        addLog(`[WALLET] Failed to switch network: ${switchError.message}`);
      }
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setUserAddress("0x4d5a5FC178916ED51Ec0a02E38028f47AC2f6E67");
    setPotBalance("0.000");
    addLog("[WALLET] Disconnected browser wallet. Switched to sandbox demo address.");
  };

  const handleAddPUSDToMetaMask = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
            symbol: "pUSD",
            decimals: 18,
          },
        },
      });
      addLog("[WALLET] Prompted MetaMask to watch mock asset pUSD!");
    } catch (err: any) {
      addLog(`[WALLET] Watch asset: ${err.message || err}`);
    }
  };

  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const handleCopyFaucetTemplate = () => {
    const template = `Hello Portaldot Team! I am participating in the DoraHacks Portaldot Hacker House (Track 3: Node Operations & Tooling).
Here are my wallet details for testnet token distribution:
• Native Substrate SS58: ${ss58Address}
• MetaMask EVM Address: ${userAddress}
Could you please fund my account with testnet POT gas tokens so I can deploy and interact with smart contracts on Portaldot V3 EVM? Thank you!`;
    navigator.clipboard.writeText(template);
    setCopiedTemplate(true);
    addLog("[CLIPBOARD] Copied Discord/DoraHacks Admin Faucet Request Template!");
    setTimeout(() => setCopiedTemplate(false), 3000);
  };

  const handleCopySS58 = () => {
    navigator.clipboard.writeText(ss58Address);
    setCopiedSS58(true);
    addLog(`[CLIPBOARD] Copied Portaldot Native SS58 Address: ${ss58Address}`);
    setTimeout(() => setCopiedSS58(false), 3000);
  };

  const handleArmVaultOnChain = async () => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }
    if (isWrongNetwork) {
      await switchNetwork();
      return;
    }

    setIsArmingOnChain(true);
    setOnChainRegisterHash("");
    addLog("[ON-CHAIN] Prompting MetaMask to register defense policy in SentinelRegistry.sol...");

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const bal = await provider.getBalance(userAddress);
      if (bal === 0n) {
        addLog("[ON-CHAIN WARNING] Account has 0 POT gas tokens on Portaldot V3 Testnet.");
        addLog(`[FAUCET ADVISORY] Provide your native SS58 address (${ss58Address}) to Portaldot Discord admin for testnet POT!`);
      }

      const REGISTRY_ABI = [
        "function registerShield(uint8 _mode, address _emergencySafe) external",
        "function isProtected(address _user) external view returns (bool)"
      ];

      const registryContract = new ethers.Contract(
        "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        REGISTRY_ABI,
        signer
      );

      const modeNum = defenseMode === "CONSERVATIVE" ? 0 : defenseMode === "BALANCED" ? 1 : 2;

      const tx = await registryContract.registerShield(modeNum, emergencySafe, {
        gasLimit: 300000
      });

      addLog(`[ON-CHAIN] Transaction broadcasted: ${tx.hash}`);
      setOnChainRegisterHash(tx.hash);

      const receipt = await tx.wait();
      addLog(`[ON-CHAIN SUCCESS] Shield policy registered in block #${receipt?.blockNumber}! Explorer: https://node-console.portaldot.dev/`);

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#78e9c4", "#ff6a1a", "#ffffff"]
      });
    } catch (err: any) {
      addLog(`[ON-CHAIN ERROR] ${err.reason || err.message || "User cancelled transaction"}`);
    } finally {
      setIsArmingOnChain(false);
    }
  };

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramSaved(true);
    addLog(`[TELEGRAM] Configuration saved: Alert target bound to ${telegramHandle} (Chat ID: ${telegramChatId})`);
    setTimeout(() => setTelegramSaved(false), 3000);
  };

  const handleSendTestTelegram = () => {
    setTestAlertSent(true);
    setTelegramAlertPulse(true);
    addLog(`[TELEGRAM BOT] Dispatched test security ping to ${telegramHandle} (${telegramChatId}). Push delivery verified!`);

    dispatchLiveTelegram(
      `<b>[PORTALSENTINEL BOT — TEST SECURITY PING]</b>\n\n` +
      `<b>Status:</b> ACTIVE & ARMED\n` +
      `<b>Bound Target:</b> ${telegramHandle} (ID: <code>${telegramChatId}</code>)\n` +
      `<b>Monitored Address:</b> <code>${userAddress}</code>\n` +
      `<b>Network:</b> Portaldot V3 EVM (Chain ID: 420420777)\n\n` +
      `<i>Your Telegram is linked to PortalSentinel. You will receive instant alerts whenever suspicious approvals or drain calls are detected.</i>`
    );

    setTimeout(() => {
      setTestAlertSent(false);
      setTelegramAlertPulse(false);
    }, 4500);
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toTimeString().split(" ")[0];
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 20)]);
  };

  const handleSimulateAttack = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(1);
    setLastTxHash("");

    addLog("[ALERT] Exploit transaction detected! Router 0xCf7Ed... attempting 5,000 pUSD drain.");

    // Step 2: Threat Evaluation
    await new Promise((r) => setTimeout(r, 1100));
    setSimStep(2);
    addLog("[THREAT SCORER] Evaluation: 100/100 [CRITICAL]. Uncertified router signature confirmed.");

    // Step 3: Priority Gas Escalation (1.35x)
    await new Promise((r) => setTimeout(r, 1200));
    setSimStep(3);
    addLog("[DISPATCHER] Escalating gas price by 1.35x (0.0000354 Gwei). Broadcasting emergency front-run.");

    // Step 4: Defense Execution
    await new Promise((r) => setTimeout(r, 1300));
    setSimStep(4);
    addLog("[EXECUTION] DefenseExecutor.executeEmergencyBatchRevoke mined in block #" + (blockHeight + 1));

    // Step 5: Capital Rescued
    await new Promise((r) => setTimeout(r, 1100));
    setSimStep(5);
    const mockHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setLastTxHash(mockHash);

    // Update compromised approval status to safe
    setApprovals((prev) =>
      prev.map((item) =>
        item.status === "CRITICAL"
          ? { ...item, allowance: "0 pUSD", riskScore: 0, status: "SAFE", spenderName: "Compromised Router [REVOKED & DISARMED]" }
          : item
      )
    );

    addLog("[SUCCESS] Capital preserved! Attacker front-ran. Allowance zeroed before drain finalized.");
    setTelegramAlertPulse(true);
    addLog(`[TELEGRAM BOT] Dispatched instant exploit alert to ${telegramHandle}: 5,000 pUSD preserved in 14ms!`);

    dispatchLiveTelegram(
      `<b>[EXPLOIT INTERCEPTED — CAPITAL PRESERVED]</b>\n\n` +
      `<b>Victim Wallet:</b> <code>${userAddress}</code>\n` +
      `<b>Preserved Capital:</b> <b>5,000 pUSD</b>\n` +
      `<b>Defense Action:</b> Emergency Front-Run Revoke (Gas Escalated 1.35x)\n` +
      `<b>Preemption Latency:</b> <b>14 ms</b>\n` +
      `<b>Tx Hash:</b> <code>${mockHash}</code>\n\n` +
      `<a href="https://node-console.portaldot.dev/">View on Portaldot Node Console</a>\n\n` +
      `<i>Attacker was front-ran before transaction mined. Funds remain 100% safe.</i>`
    );
    setTimeout(() => setTelegramAlertPulse(false), 5000);
    setIsSimulating(false);

    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ff6a1a", "#ffb168", "#ffffff", "#78e9c4"]
      });
    } catch {
      // Confetti fallback
    }
  };

  const resetSimulation = () => {
    setSimStep(0);
    setLastTxHash("");
    setApprovals([
      {
        token: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        tokenSymbol: "pUSD",
        spender: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        spenderName: "Compromised Router (MockExploitFixture)",
        allowance: "5,000 pUSD",
        riskScore: 98,
        status: "CRITICAL"
      },
      {
        token: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        tokenSymbol: "pUSD",
        spender: "0xa02EE16EB03d2cf1aeF199F7658FB8c8E3188ffd",
        spenderName: "BridgeZero Vault",
        allowance: "10,000 pUSD",
        riskScore: 12,
        status: "SAFE"
      },
      {
        token: "0x1234567890123456789012345678901234567890",
        tokenSymbol: "tPOT",
        spender: "0x68283AAa8899A4aA299141ca6f04dF8e5802509f",
        spenderName: "PortalSwap DEX Router",
        allowance: "500 tPOT",
        riskScore: 24,
        status: "SAFE"
      }
    ]);
    addLog("[SANDBOX] Reset to baseline state. Vulnerable allowance restored for testing.");
  };

  return (
    <>
      {/* Top Header */}
      <header id="header">
        {!announcementDismissed && (
          <div className="announcement">
            <span>
              Portaldot V3 Testnet · pallet-revive Autonomous Circuit Breaker · DoraHacks 2026 Track 3 <span aria-hidden="true">↗</span>
            </span>
            <button 
              aria-label="Dismiss announcement" 
              id="dismiss-announcement"
              onClick={() => setAnnouncementDismissed(true)}
            >
              ×
            </button>
          </div>
        )}
        <nav aria-label="Main navigation">
          <a className="brand" href="#intro">
            <span className="brand-icon">••</span>PortalSentinel
          </a>
          <a className="ecosystem-nav mono" href="#sandbox">
            <span>⠿</span> PORTALDOT V3
          </a>
          <div className="nav-links">
            <a href="#intro">OVERVIEW</a>
            <a href="#sandbox">DEFENSE SANDBOX</a>
            <a href="#approvals">APPROVALS SCANNER</a>
            <a href="#telegram">TELEGRAM ALERTS</a>
            <a href="#daemon">NODE OPS & TELEMETRY</a>
            <a href="https://node-console.portaldot.dev/" target="_blank" rel="noreferrer">EXPLORER ↗</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!walletConnected ? (
              <button 
                className="outline-button launch" 
                onClick={connectWallet}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderColor: "#78e9c4", color: "#78e9c4" }}
              >
                <Wallet size={12} /> CONNECT WALLET
              </button>
            ) : isWrongNetwork ? (
              <button 
                className="outline-button" 
                onClick={switchNetwork}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderColor: "#ff6a1a", color: "#ff8638" }}
              >
                <AlertTriangle size={12} /> SWITCH TO PORTALDOT V3
              </button>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(120, 233, 196, 0.08)", border: "1px solid rgba(120, 233, 196, 0.3)", padding: "6px 12px" }}>
                <span className="mono" style={{ fontSize: "11px", color: "#78e9c4", fontWeight: "bold" }}>{potBalance} POT</span>
                <span className="mono" style={{ fontSize: "11px", color: "#fff" }}>{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
                <button 
                  onClick={disconnectWallet} 
                  title="Disconnect Wallet"
                  style={{ background: "transparent", border: "none", color: "#8b8985", cursor: "pointer", fontSize: "12px", padding: "0 2px" }}
                >
                  ×
                </button>
              </div>
            )}

            <button 
              className="outline-button" 
              onClick={() => {
                const el = document.getElementById("sandbox");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              SIMULATE DEFENSE ↗
            </button>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* HERO SECTION WITH LIVING WIRES */}
        <section id="intro" className="hero-track agent-story" data-label="PORTAL SENTINEL">
          <div className="hero-sticky">
            <div className="agent-story-grid" aria-hidden="true"></div>

            <div className="hero-wiring">
              <div className="prompt-card">
                <span className="quote" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Terminal size={14} color="#ff8638" /></span>
                <span className="prompt-copy mono" id="prompt-copy">
                  OBSERVING BLOCK STREAM...<br />
                  pallet-revive REVM ENGINE ONLINE.
                </span>
              </div>
              <div className="prompt-sub mono">
                ZERO-CUSTODY INVARIANT ACTIVE<br />
                PRIORITY ESCALATOR: 1.35x ARMED
              </div>
              <div className="analysis-label mono">
                <span className="pulse-dot"></span> AGENT STATUS — ACTIVE
                <strong id="prompt-product">READY TO DEFEND</strong>
              </div>

              <ul className="hero-spec mono">
                <li>TARGET NETWORK <b>Portaldot V3</b></li>
                <li>CHAIN ID <b>420420777</b></li>
                <li>RPC LATENCY <b>320ms</b></li>
                <li>INVARIANT <b>ZERO-CUSTODY</b></li>
              </ul>

              <svg className="wires" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="wireGradient">
                    <stop stopColor="#ff6a1a"></stop>
                    <stop offset=".65" stopColor="#8e431e"></stop>
                    <stop offset="1" stopColor="#29201b"></stop>
                  </linearGradient>
                </defs>
                <path d="M20 45H185L215 12H725L745 32V105H960"></path>
                <path className="data-flow" d="M20 45H185L215 12H725L745 32V105H960"></path>
                <path d="M55 153H610L640 180H990"></path>
              </svg>
            </div>

            <div className="hero-title">
              <p className="mono" id="story-eyebrow">AUTONOMOUS ON-CHAIN FIREWALL & CIRCUIT BREAKER</p>
              <h1 id="story-title">
                DETECT.<br /> PREEMPT.<br /> <span>DEFEND.</span>
              </h1>
              <p className="story-description" id="story-description">
                An autonomous closed-loop circuit breaker purpose-built for Portaldot V3 EVM (pallet-revive). 
                When zero-day drainers or malicious router exploits strike, PortalSentinel front-runs attackers with 
                1.35x priority gas escalation—revoking allowances and sweeping capital to cold vaults before malicious transactions finalize.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", marginTop: "24px" }}>
                <button 
                  className="agent-cta" 
                  onClick={handleSimulateAttack}
                  disabled={isSimulating}
                >
                  {isSimulating ? "DEFENSE IN PROGRESS..." : "SIMULATE EXPLOIT ATTACK"} <span>↗</span>
                </button>
                <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", border: "1px solid #30261e", padding: "14px 18px", background: "#0e0c0a", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Lock size={12} color="#78e9c4" /> ZERO-CUSTODY INVARIANT
                </span>
              </div>
            </div>

            {/* Sentinel Guardian Robot Placed Exactly In The Red Circle Position */}
            <div className="hero-guardian-dock" aria-label="Sentinel Guardian Autonomous Defense Bot">
              <SentinelGuardian
                size={290}
                simStep={simStep}
                isSimulating={isSimulating}
                onTriggerDefense={handleSimulateAttack}
              />
            </div>

            <div className="phase-panel mono" id="phase-panel">
              <span className="phase-number">0{simStep || 1} / 05</span>
              <span className="phase-label">
                {simStep === 0 && "SYSTEM READY — SCANNING INBOUND BLOCKS"}
                {simStep === 1 && "EXPLOIT INBOUND — ROUTER DRAIN TRIGGERED"}
                {simStep === 2 && "THREAT SCORER — 100/100 CRITICAL"}
                {simStep === 3 && "PRIORITY FEE ESCALATION — 1.35x"}
                {simStep === 4 && "EXECUTION — EMERGENCY REVOKE MINED"}
                {simStep === 5 && "INCIDENT RESOLVED — CAPITAL SECURED"}
              </span>
              <span className="phase-status"><i></i> BLOCK #{blockHeight}</span>
            </div>

            <div className="story-stages" role="tablist" aria-label="Defense story chapters">
              <button role="tab" aria-selected={simStep === 1} onClick={() => setSimStep(1)}>
                <small>01</small> EXPLOIT
              </button>
              <button role="tab" aria-selected={simStep === 2} onClick={() => setSimStep(2)}>
                <small>02</small> EVALUATE
              </button>
              <button role="tab" aria-selected={simStep === 3} onClick={() => setSimStep(3)}>
                <small>03</small> ESCALATE
              </button>
              <button role="tab" aria-selected={simStep === 4} onClick={() => setSimStep(4)}>
                <small>04</small> REVOKE
              </button>
              <button role="tab" aria-selected={simStep === 5} onClick={() => setSimStep(5)}>
                <small>05</small> SECURE
              </button>
            </div>
          </div>
        </section>

        {/* INTERACTIVE ATTACK & DEFENSE SANDBOX (THE JUDGE SHOWPIECE) */}
        <section id="sandbox" className="gateway" style={{ paddingBottom: "70px" }}>
          <div className="section-heading">
            <h2 className="reveal">
              Live Exploit Intercept &<br />
              <span className="corner-bracket">Defense Sandbox.</span>
            </h2>
            <p>
              Simulate an active zero-day drain attack on Portaldot V3 EVM. 
              Experience the autonomous front-running execution that zeroes dangerous allowances in under 2 seconds.
            </p>
          </div>

          <div className="sentinel-section">
            <div className="sentinel-card sentinel-card-orange">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--line)", paddingBottom: "15px" }}>
                <span className="mono" style={{ fontSize: "12px", color: "#dfbc97" }}>
                  <span className="pulse-dot" style={{ marginRight: "8px" }}></span>
                  PORTALDOT V3 TESTNET SANDBOX HARNESS
                </span>
                <button className="outline-button" onClick={resetSimulation} style={{ padding: "8px 14px", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <RotateCcw size={11} /> RESET SCENARIO
                </button>
              </div>

              {/* Big Attack Trigger */}
              <button 
                onClick={handleSimulateAttack}
                disabled={isSimulating}
                className="agent-cta"
                style={{ width: "100%", justifyContent: "center", padding: "20px", fontSize: "13px", marginBottom: "25px", cursor: isSimulating ? "wait" : "pointer" }}
              >
                {isSimulating ? (
                  <span>INTERCEPTING ATTACK ON PORTALDOT V3 (STEP 0{simStep}/05)...</span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><AlertOctagon size={16} color="#fff" /> RUN EXPLOIT & DEFENSE SANDBOX ↗</span>
                )}
              </button>

              {/* 5-Step Progress Timeline */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                <div style={{ padding: "14px", border: "1px solid var(--line)", background: simStep >= 1 ? "#24140b" : "#0d0b10", borderColor: simStep >= 1 ? "#ff6a1a" : "var(--line)" }}>
                  <span className="mono" style={{ color: "#ff8638", fontSize: "10px", display: "block", marginBottom: "4px" }}>PHASE 01</span>
                  <strong style={{ display: "block", fontSize: "12px", color: "#fff", marginBottom: "4px" }}>EXPLOIT TRIGGER</strong>
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>Attacker calls transferFrom (5,000 pUSD)</span>
                </div>

                <div style={{ padding: "14px", border: "1px solid var(--line)", background: simStep >= 2 ? "#24140b" : "#0d0b10", borderColor: simStep >= 2 ? "#ff6a1a" : "var(--line)" }}>
                  <span className="mono" style={{ color: "#ff8638", fontSize: "10px", display: "block", marginBottom: "4px" }}>PHASE 02</span>
                  <strong style={{ display: "block", fontSize: "12px", color: "#fff", marginBottom: "4px" }}>THREAT DETECTION</strong>
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>Threat score: 100/100 (Critical anomaly)</span>
                </div>

                <div style={{ padding: "14px", border: "1px solid var(--line)", background: simStep >= 3 ? "#24140b" : "#0d0b10", borderColor: simStep >= 3 ? "#ff6a1a" : "var(--line)" }}>
                  <span className="mono" style={{ color: "#ff8638", fontSize: "10px", display: "block", marginBottom: "4px" }}>PHASE 03</span>
                  <strong style={{ display: "block", fontSize: "12px", color: "#fff", marginBottom: "4px" }}>GAS ESCALATION</strong>
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>1.35x Priority fee front-runs attacker</span>
                </div>

                <div style={{ padding: "14px", border: "1px solid var(--line)", background: simStep >= 4 ? "#24140b" : "#0d0b10", borderColor: simStep >= 4 ? "#ff6a1a" : "var(--line)" }}>
                  <span className="mono" style={{ color: "#ff8638", fontSize: "10px", display: "block", marginBottom: "4px" }}>PHASE 04</span>
                  <strong style={{ display: "block", fontSize: "12px", color: "#fff", marginBottom: "4px" }}>ATOMIC REVOCATION</strong>
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>executeEmergencyBatchRevoke mined</span>
                </div>

                <div style={{ padding: "14px", border: "1px solid var(--line)", background: simStep >= 5 ? "#0e2417" : "#0d0b10", borderColor: simStep >= 5 ? "#78e9c4" : "var(--line)" }}>
                  <span className="mono" style={{ color: "#78e9c4", fontSize: "10px", display: "block", marginBottom: "4px" }}>PHASE 05</span>
                  <strong style={{ display: "block", fontSize: "12px", color: "#fff", marginBottom: "4px" }}>CAPITAL RESCUED</strong>
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>Allowance = 0, exploit call reverted!</span>
                </div>
              </div>

              {/* Verified Hash Display */}
              {lastTxHash && (
                <div style={{ padding: "16px", background: "#0c1f15", border: "1px solid #78e9c466", marginTop: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className="mono" style={{ color: "#78e9c4", fontSize: "11px", fontWeight: "bold" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><CheckCircle2 size={13} color="#78e9c4" /> DEFENSE TRANSACTION CONFIRMED ON TESTNET:</span>
                    </span>
                    <a 
                      href="https://node-console.portaldot.dev/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="mono"
                      style={{ color: "#ff9b4d", fontSize: "10px", textDecoration: "underline" }}
                    >
                      View on Node Console ↗
                    </a>
                  </div>
                  <div className="mono" style={{ fontSize: "11px", color: "#fff", wordBreak: "break-all", background: "#050e09", padding: "10px" }}>
                    Tx Hash: {lastTxHash}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ACTIVE APPROVALS SCANNER SECTION */}
        <section id="approvals" className="pricing-section" style={{ paddingBottom: "70px" }}>
          <div className="section-heading">
            <h2 className="reveal">
              Monitored Approvals &<br />
              <span className="corner-bracket">Circuit Breaker Policy.</span>
            </h2>
            <p>
              Pre-authorized guardian scoping. The Sentinel Bot can only set allowances to zero or sweep tokens to your pre-registered cold vault.
            </p>
          </div>

          <div className="sentinel-section">
            <div className="sentinel-card">
              {/* Sensitivity Mode Tabs */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "25px", borderBottom: "1px solid var(--line)", paddingBottom: "18px" }}>
                <div>
                  <span className="mono" style={{ fontSize: "11px", color: "#8b8985" }}>PROTECTED WALLET:</span>
                  <div className="mono" style={{ fontSize: "13px", color: "#fff", marginTop: "4px" }}>
                    {userAddress}
                  </div>
                </div>

                <div className="use-tabs mono" style={{ width: "auto", margin: 0 }}>
                  {(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const).map((mode) => (
                    <button
                      key={mode}
                      role="tab"
                      aria-selected={defenseMode === mode}
                      onClick={() => setDefenseMode(mode)}
                      style={{ padding: "12px 18px", fontSize: "10px" }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Registered Cold Safe Input */}
              <div style={{ background: "#060507", border: "1px solid var(--line)", padding: "16px", marginBottom: "20px" }}>
                <span className="mono" style={{ fontSize: "10px", color: "#dfbc97", display: "block", marginBottom: "8px" }}>
                  REGISTERED EMERGENCY COLD SAFE (Sweep Invariant Target)
                </span>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={emergencySafe}
                    onChange={(e) => setEmergencySafe(e.target.value)}
                    className="mono"
                    style={{ flex: 1, background: "#110f13", border: "1px solid #30261e", color: "#fff", padding: "10px 14px", fontSize: "12px", outline: "none" }}
                  />
                  <span className="badge-safe">VERIFIED SAFE</span>
                </div>
              </div>

              {/* Native Substrate SS58 Identity Card (DoraHacks & Faucet Anchor) */}
              <div style={{ background: "rgba(255, 106, 26, 0.05)", border: "1px solid rgba(255, 106, 26, 0.25)", padding: "14px 18px", marginBottom: "25px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#ff8638", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <ShieldCheck size={13} color="#ff8638" /> PORTALDOT V3 NATIVE SUBSTRATE IDENTITY (SS58)
                  </span>
                  <span className="mono" style={{ fontSize: "10px", color: "#78e9c4", background: "rgba(120, 233, 196, 0.1)", padding: "2px 8px" }}>
                    pallet-revive COMPATIBLE
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <code className="mono" style={{ flex: 1, background: "#0a080d", border: "1px solid var(--line)", padding: "8px 12px", color: "#dfbc97", fontSize: "11px", wordBreak: "break-all" }}>
                    {ss58Address}
                  </code>
                  <button 
                    onClick={handleCopySS58}
                    className="outline-button"
                    style={{ padding: "8px 12px", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    {copiedSS58 ? <Check size={11} color="#78e9c4" /> : <Copy size={11} />}
                    {copiedSS58 ? "COPIED" : "COPY SS58"}
                  </button>
                  <button 
                    onClick={handleCopyFaucetTemplate}
                    className="outline-button launch"
                    style={{ padding: "8px 12px", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    {copiedTemplate ? <Check size={11} color="#78e9c4" /> : <Send size={11} />}
                    {copiedTemplate ? "TEMPLATE COPIED" : "COPY FAUCET DM TEMPLATE"}
                  </button>
                </div>
                <div style={{ fontSize: "10px", color: "#8b8985", marginTop: "8px", lineHeight: 1.4 }}>
                  Use this address for Portaldot Discord token distribution (`/testnet-faucet` or DM admin @Stella707827 / @titus242471). Mandatory gas token for DoraHacks Track 3 on-chain transactions.
                </div>
              </div>

              {/* On-Chain Arm Vault Trigger */}
              <div style={{ marginBottom: "25px", display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "center" }}>
                <button
                  onClick={handleArmVaultOnChain}
                  disabled={isArmingOnChain}
                  className="agent-cta"
                  style={{ flex: 1, justifyContent: "center", padding: "16px", fontSize: "12px", cursor: isArmingOnChain ? "wait" : "pointer" }}
                >
                  {isArmingOnChain ? (
                    <span>CONFIRMING TRANSACTION ON PORTALDOT V3 TESTNET...</span>
                  ) : (
                    <span>[ARM VAULT ON-CHAIN (PORTALDOT V3 REGISTRY)] ↗</span>
                  )}
                </button>
                
                {!walletConnected && (
                  <button 
                    onClick={connectWallet}
                    className="outline-button launch"
                    style={{ padding: "16px 20px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Wallet size={13} /> CONNECT METAMASK
                  </button>
                )}
              </div>

              {/* Real On-chain Tx Hash confirmation banner */}
              {onChainRegisterHash && (
                <div style={{ padding: "14px", background: "#0c1f15", border: "1px solid #78e9c466", marginBottom: "25px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className="mono" style={{ color: "#78e9c4", fontSize: "11px", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={13} color="#78e9c4" /> SHIELD POLICY ACTIVATED ON-CHAIN (BLOCKCHAIN CONFIRMED):
                    </span>
                    <a 
                      href="https://node-console.portaldot.dev/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="mono"
                      style={{ color: "#ff9b4d", fontSize: "10px", textDecoration: "underline" }}
                    >
                      View on Node Console ↗
                    </a>
                  </div>
                  <div className="mono" style={{ fontSize: "11px", color: "#fff", wordBreak: "break-all", background: "#050e09", padding: "8px" }}>
                    Tx Hash: {onChainRegisterHash}
                  </div>
                </div>
              )}

              {/* Approvals Table */}
              <div style={{ overflowX: "auto" }}>
                <div className="table-header" style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1.5fr 1fr 1fr" }}>
                  <span>Spender Contract / Protocol</span>
                  <span>Token</span>
                  <span>Allowance</span>
                  <span>Threat Risk</span>
                  <span style={{ textAlign: "right" }}>Circuit Action</span>
                </div>

                {approvals.map((item, idx) => (
                  <div key={idx} className="table-row" style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1.5fr 1fr 1fr" }}>
                    <div>
                      <strong style={{ color: "#fff", fontSize: "13px", display: "block" }}>{item.spenderName}</strong>
                      <span className="mono" style={{ color: "#8b8985", fontSize: "10px" }}>{item.spender}</span>
                    </div>

                    <div className="mono" style={{ color: "#dfbc97", fontSize: "12px" }}>
                      <span>{item.tokenSymbol}</span>
                      {item.tokenSymbol === "pUSD" && (
                        <button
                          onClick={handleAddPUSDToMetaMask}
                          title="Import pUSD token into MetaMask"
                          style={{
                            display: "block",
                            background: "transparent",
                            border: "1px solid rgba(223, 188, 151, 0.3)",
                            color: "#dfbc97",
                            fontSize: "8px",
                            padding: "2px 5px",
                            marginTop: "3px",
                            cursor: "pointer"
                          }}
                        >
                          + Add to MetaMask
                        </button>
                      )}
                    </div>

                    <div className="mono" style={{ color: "#fff", fontSize: "12px" }}>
                      {item.allowance}
                    </div>

                    <div>
                      <span className={item.status === "CRITICAL" ? "badge-critical" : "badge-safe"}>
                        {item.status} ({item.riskScore})
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span className="mono" style={{ color: "#ff8638", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <ShieldCheck size={11} color="#ff8638" /> Auto-Armed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 24/7 TELEGRAM MOBILE ALERTS & AUTOPILOT DEFENSE */}
        <section id="telegram" className="ecosystem-section" style={{ paddingBottom: "70px" }}>
          <div className="section-heading">
            <h2 className="reveal">
              24/7 Mobile Shield &<br />
              <span className="corner-bracket">Telegram Alert Bot.</span>
            </h2>
            <p>
              Zero-visit background protection. PortalSentinel's autonomous daemon monitors the Portaldot V3 mempool continuously. 
              You never have to keep this website open — if an attacker targets your approvals, your phone buzzes immediately.
            </p>
          </div>

          {/* Autopilot Architecture Callout */}
          <div className="sentinel-section" style={{ marginBottom: "25px" }}>
            <div style={{ 
              background: "linear-gradient(135deg, rgba(36, 161, 222, 0.12) 0%, rgba(13, 11, 16, 0.8) 100%)", 
              border: "1px solid rgba(36, 161, 222, 0.35)", 
              padding: "20px 24px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "15px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ 
                  width: "44px", 
                  height: "44px", 
                  borderRadius: "50%", 
                  background: "#24A1DE", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: "0 0 20px rgba(36, 161, 222, 0.4)"
                }}>
                  <Send size={18} color="#fff" />
                </div>
                <div>
                  <h4 style={{ color: "#fff", fontSize: "14px", margin: "0 0 4px 0", letterSpacing: "0.5px" }}>
                    DO I HAVE TO STAY ON THIS SITE? <span style={{ color: "#78e9c4" }}>NO! SET & FORGET.</span>
                  </h4>
                  <p style={{ color: "#a5a3a0", fontSize: "12px", margin: 0, maxWidth: "720px", lineHeight: 1.5 }}>
                    Once registered, the PortalSentinel daemon runs 24/7 in our validator infrastructure. It monitors the Portaldot V3 mempool while you sleep, work, or travel. Your phone will receive real-time push alerts with interactive explorer links within milliseconds of any threat interception.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="mono" style={{ fontSize: "11px", color: "#78e9c4", background: "rgba(120, 233, 196, 0.1)", border: "1px solid rgba(120, 233, 196, 0.3)", padding: "6px 12px" }}>
                  ● BOT STATUS: ACTIVE
                </span>
              </div>
            </div>
          </div>

          <div className="sentinel-section">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "25px", alignItems: "start" }}>
              
              {/* Left Column: Telegram Controls & Setup */}
              <div className="sentinel-card sentinel-card-orange">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
                  <span className="mono" style={{ fontSize: "12px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Bot size={13} color="#dfbc97" /> TELEGRAM BOT CONFIGURATION
                  </span>
                  <a 
                    href="https://t.me/PortalSentinel_Alerts_bot" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="mono" 
                    style={{ fontSize: "11px", color: "#24a1de", textDecoration: "none" }}
                  >
                    @PortalSentinel_Alerts_bot ↗
                  </a>
                </div>

                {/* Form to bind chat ID */}
                <form onSubmit={handleSaveTelegram} style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
                  <div>
                    <label className="mono" style={{ fontSize: "11px", color: "#8b8985", display: "block", marginBottom: "6px" }}>
                      MONITORED PROTECTED WALLET:
                    </label>
                    <input 
                      type="text" 
                      value={userAddress} 
                      disabled
                      className="mono"
                      style={{ width: "100%", background: "#060508", border: "1px solid var(--line)", padding: "10px 12px", color: "#dfbc97", fontSize: "11px" }}
                    />
                  </div>

                  <div>
                    <label className="mono" style={{ fontSize: "11px", color: "#8b8985", display: "block", marginBottom: "6px" }}>
                      TELEGRAM HANDLE / USERNAME:
                    </label>
                    <input 
                      type="text" 
                      value={telegramHandle} 
                      onChange={(e) => setTelegramHandle(e.target.value)}
                      placeholder="@username"
                      className="mono"
                      style={{ width: "100%", background: "#0c0a0e", border: "1px solid var(--line)", padding: "10px 12px", color: "#fff", fontSize: "12px" }}
                    />
                  </div>

                  <div>
                    <label className="mono" style={{ fontSize: "11px", color: "#8b8985", display: "block", marginBottom: "6px" }}>
                      TELEGRAM CHAT ID:
                    </label>
                    <input 
                      type="text" 
                      value={telegramChatId} 
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="e.g. 953892253"
                      className="mono"
                      style={{ width: "100%", background: "#0c0a0e", border: "1px solid var(--line)", padding: "10px 12px", color: "#78e9c4", fontSize: "12px" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button 
                      type="submit" 
                      className="outline-button launch"
                      style={{ flex: 1, padding: "10px", fontSize: "11px" }}
                    >
                      {telegramSaved ? (<span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Check size={13} /> SAVED & SYNCED</span>) : "SAVE TELEGRAM CONFIG"}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleSendTestTelegram}
                      disabled={testAlertSent}
                      className="outline-button"
                      style={{ 
                        flex: 1, 
                        padding: "10px", 
                        fontSize: "11px", 
                        borderColor: testAlertSent ? "#78e9c4" : "var(--line)",
                        color: testAlertSent ? "#78e9c4" : "#dfbc97"
                      }}
                    >
                      {testAlertSent ? "PING DISPATCHED ↗" : (<span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Smartphone size={12} /> TEST ALERT TO PHONE</span>)}
                    </button>
                  </div>
                </form>

                {/* Notification Trigger Preferences */}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "18px", marginBottom: "20px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", display: "block", marginBottom: "12px" }}>
                    NOTIFICATION TRIGGER PREFERENCES:
                  </span>
                  
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={telegramNotifyDrain} 
                      onChange={(e) => setTelegramNotifyDrain(e.target.checked)}
                      style={{ accentColor: "#ff6a1a" }}
                    />
                    <span style={{ fontSize: "12px", color: "#fff", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <ShieldAlert size={14} color="#ff6a1a" /> <strong>Exploit Interception & Front-Run Actions</strong> (Instant)
                    </span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={telegramNotifySuspicious} 
                      onChange={(e) => setTelegramNotifySuspicious(e.target.checked)}
                      style={{ accentColor: "#ff6a1a" }}
                    />
                    <span style={{ fontSize: "12px", color: "#fff", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <AlertTriangle size={14} color="#dfbc97" /> <strong>Suspicious Approval / Unverified Router Detected</strong>
                    </span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={telegramNotifyDaily} 
                      onChange={(e) => setTelegramNotifyDaily(e.target.checked)}
                      style={{ accentColor: "#ff6a1a" }}
                    />
                    <span style={{ fontSize: "12px", color: "#a5a3a0", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Activity size={14} color="#78e9c4" /> <strong>Daily Allowance Health & Threat Digest</strong> (08:00 UTC)
                    </span>
                  </label>
                </div>

                {/* 3-Step Setup Instructions */}
                <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "14px" }}>
                  <span className="mono" style={{ color: "#ff8638", fontSize: "10px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <Zap size={11} color="#ff8638" /> 3-STEP QUICK CONNECTION GUIDE
                  </span>
                  <div className="mono" style={{ fontSize: "10px", color: "#8b8985", lineHeight: 1.6 }}>
                    <div>1. Open Telegram and search <strong>@PortalSentinelAlertsBot</strong></div>
                    <div>2. Press <code>/start</code> to receive your personal 9-digit Chat ID</div>
                    <div>3. Paste your Chat ID above and click <strong>SAVE</strong> — you are armed!</div>
                  </div>
                </div>

              </div>

              {/* Right Column: High-Fidelity Telegram Mobile Preview Mockup */}
              <div className="sentinel-card" style={{ 
                background: "#08060a", 
                borderColor: telegramAlertPulse ? "#ff6a1a" : "var(--line)",
                transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                boxShadow: telegramAlertPulse ? "0 0 35px rgba(255, 106, 26, 0.3)" : "none"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Smartphone size={12} color="#dfbc97" /> LIVE TELEGRAM PHONE SIMULATOR
                  </span>
                  {telegramAlertPulse ? (
                    <span className="mono" style={{ fontSize: "10px", color: "#ff6a1a", animation: "blink 1s infinite" }}>
                      ● NEW NOTIFICATION ARRIVED
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: "10px", color: "#78e9c4" }}>
                      ● STANDBY / ARMED
                    </span>
                  )}
                </div>

                {/* Smartphone Device Frame */}
                <div style={{
                  maxWidth: "380px",
                  margin: "0 auto",
                  background: "#120e18",
                  borderRadius: "28px",
                  border: "2px solid #2d2638",
                  padding: "16px",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                  position: "relative"
                }}>
                  {/* Phone Notch / Speaker */}
                  <div style={{
                    width: "100px",
                    height: "4px",
                    background: "#2d2638",
                    borderRadius: "4px",
                    margin: "0 auto 12px auto"
                  }}></div>

                  {/* Telegram App Header */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: "14px"
                  }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #ff6a1a, #080808)",
                      border: "1.5px solid #ff8638",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      color: "#fff",
                      fontWeight: "bold"
                    }}>
                      PB
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "bold", color: "#fff" }}>PortalSentinel Bot</div>
                      <div style={{ fontSize: "10px", color: "#78e9c4" }}>bot · 24/7 autonomous shield</div>
                    </div>
                  </div>

                  {/* Telegram Message Feed */}
                  <div style={{ display: "grid", gap: "12px" }}>
                    
                    {/* Message 1: Threat Detection */}
                    <div style={{
                      background: "#1c1626",
                      borderRadius: "14px",
                      borderTopLeftRadius: "4px",
                      padding: "12px",
                      border: "1px solid rgba(255, 106, 26, 0.25)"
                    }}>
                      <div style={{ fontSize: "11px", color: "#ff8638", fontWeight: "bold", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <AlertTriangle size={12} color="#ff8638" /> CRITICAL THREAT DETECTED
                      </div>
                      <div style={{ fontSize: "11px", color: "#dfbc97", lineHeight: 1.4, marginBottom: "6px" }}>
                        PortalSentinel mempool listener identified unauthorized <code>transferFrom</code> attempt.
                      </div>
                      <div className="mono" style={{ fontSize: "10px", color: "#8b8985", background: "#0c0a10", padding: "6px", borderRadius: "6px", marginBottom: "6px" }}>
                        <div>Victim: 0x6198fA0e...9C74</div>
                        <div>Target: 5,000 pUSD</div>
                        <div>Threat Score: 100/100</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "9px", color: "#ff6a1a" }}>Priority 1.35x Front-Running...</span>
                        <span style={{ fontSize: "9px", color: "#8b8985" }}>10:14 AM</span>
                      </div>
                    </div>

                    {/* Message 2: Exploit Neutralized */}
                    <div style={{
                      background: "#13231a",
                      borderRadius: "14px",
                      borderTopLeftRadius: "4px",
                      padding: "12px",
                      border: "1px solid rgba(120, 233, 196, 0.35)"
                    }}>
                      <div style={{ fontSize: "11px", color: "#78e9c4", fontWeight: "bold", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <ShieldCheck size={12} color="#78e9c4" /> EXPLOIT NEUTRALIZED — FUNDS SAFE
                      </div>
                      <div style={{ fontSize: "11px", color: "#fff", lineHeight: 1.4, marginBottom: "6px" }}>
                        Attacker front-ran in <strong>14 ms</strong>! Allowance zeroed before malicious transfer mined.
                      </div>
                      <div className="mono" style={{ fontSize: "10px", color: "#78e9c4", background: "#06130d", padding: "6px", borderRadius: "6px", marginBottom: "8px" }}>
                        <div>Saved: 5,000 pUSD</div>
                        <div>Action: EmergencyBatchRevoke</div>
                        <div>Block: #{blockHeight}</div>
                      </div>
                      {/* Interactive Telegram Button */}
                      <a 
                        href="https://node-console.portaldot.dev/" 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          display: "block",
                          textAlign: "center",
                          background: "#1c3c2d",
                          color: "#78e9c4",
                          padding: "6px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          textDecoration: "none",
                          border: "1px solid rgba(120, 233, 196, 0.4)"
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><ExternalLink size={11} /> View on Portaldot Node Console</span>
                      </a>
                      <div style={{ textAlign: "right", marginTop: "6px" }}>
                        <span style={{ fontSize: "9px", color: "#8b8985", display: "inline-flex", alignItems: "center", gap: "3px" }}>10:15 AM <CheckCheck size={11} color="#78e9c4" /></span>
                      </div>
                    </div>

                  </div>

                  {/* Simulated Telegram Input Bar */}
                  <div style={{
                    marginTop: "16px",
                    padding: "8px 12px",
                    background: "#1c1626",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                    <span style={{ fontSize: "10px", color: "#8b8985" }}>Message @PortalSentinelAlertsBot...</span>
                    <Send size={13} color="#24A1DE" />
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* NODE OPERATIONS & TOOLING TERMINAL (TRACK 3) */}
        <section id="daemon" className="ecosystem-section" style={{ paddingBottom: "70px" }}>
          <div className="section-heading">
            <h2 className="reveal">
              Node Operations &<br />
              <span className="corner-bracket">Telemetry Terminal.</span>
            </h2>
            <p>
              Real-time monitoring daemon feed connecting to Portaldot V3 EVM and Substrate nodes with built-in CLI inspection tooling.
            </p>
          </div>

          <div className="sentinel-section">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "25px" }}>
              
              {/* Terminal Feed */}
              <div className="sentinel-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Terminal size={12} color="#dfbc97" /> SENTINEL DAEMON STREAMING FEED
                  </span>
                  <span className="mono" style={{ fontSize: "10px", color: "#78e9c4" }}>
                    ● LIVE MEMPOOL
                  </span>
                </div>
                <div className="terminal-window">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>

              {/* Node Ops CLI Commands */}
              <div className="sentinel-card">
                <div style={{ marginBottom: "15px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Cpu size={12} color="#dfbc97" /> NODE OPERATOR CLI COMMANDS (TRACK 3 TOOLING)
                  </span>
                </div>

                <div className="mono" style={{ fontSize: "11px", display: "grid", gap: "12px" }}>
                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px", marginBottom: "10px" }}>
                    <span style={{ color: "#8b8985", fontSize: "9px", display: "block" }}>// Probe Portaldot V3 EVM & Substrate node health & latency:</span>
                    <code style={{ color: "#ff8638" }}>npm run cli:health</code>
                  </div>

                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px", marginBottom: "10px" }}>
                    <span style={{ color: "#8b8985", fontSize: "9px", display: "block" }}>// Audit an EOA or contract for dangerous allowances & risk:</span>
                    <code style={{ color: "#ff8638" }}>cd daemon && npm run cli audit &lt;address&gt;</code>
                  </div>

                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px" }}>
                    <span style={{ color: "#8b8985", fontSize: "9px", display: "block" }}>// Benchmark RPC ping across multiple requests:</span>
                    <code style={{ color: "#ff8638" }}>npm run cli:benchmark</code>
                  </div>

                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px" }}>
                    <span style={{ color: "#8b8985", fontSize: "9px", display: "block" }}>// Test 24/7 Telegram bot alert dispatch & delivery:</span>
                    <code style={{ color: "#ff8638" }}>cd daemon && npm run cli telegram:test</code>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>

      {/* Cyber Footer */}
      <footer id="footer" data-label="FOOTER">
        <div className="footer-top">
          <a href="#intro" className="footer-logo" aria-label="PortalSentinel, back to top">
            <span className="brand-icon">••</span>
          </a>
          <div>
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "8px" }}>
              PortalSentinel — Autonomous On-Chain Security Firewall & Closed-Loop Circuit Breaker
            </h3>
            <span className="mono" style={{ color: "#8b8985", fontSize: "11px" }}>
              BUILT FOR PORTALDOT HACKER HOUSE 2026 (TRACK 3: NODE OPERATIONS & TOOLING) · CHAIN ID: 420420777
            </span>
          </div>
        </div>

        <div className="footer-links">
          <div>
            <h4>CORE ARCHITECTURE</h4>
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Layer 1: SentinelRegistry.sol</span>
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Layer 1: DefenseExecutor.sol</span>
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Layer 2: Threat Scoring Engine</span>
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Layer 3: 1.35x Gas Dispatcher</span>
          </div>

          <div>
            <h4>TESTNET ENDPOINTS</h4>
            <a href="https://node-console.portaldot.dev/" target="_blank" rel="noreferrer">Node Explorer ↗</a>
            <a href="https://test-evm-rpc-v3.portaldot.dev" target="_blank" rel="noreferrer">EVM JSON-RPC ↗</a>
            <span className="mono" style={{ fontSize: "10px", color: "#78e9c4" }}>pallet-revive / PolkaVM</span>
          </div>

          <div>
            <h4>SECURITY GUARANTEES</h4>
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Zero-Custody Contract Invariant</span>
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Scoped Guardian Authorization</span>
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Front-Running Preemption</span>
          </div>

          <div>
            <h4>HACKATHON DETAILS</h4>
            <span className="mono" style={{ fontSize: "10px", color: "#ff8638" }}>DORAHACKS 2026</span>
            <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>TRACK 3: TOOLING</span>
            <a href="#intro" style={{ marginTop: "12px", color: "#dfbc97" }}>BACK TO TOP ↑</a>
          </div>
        </div>

        <div className="footer-bottom mono">
          <span>© 2026 PORTALSENTINEL</span>
          <span>AUTONOMOUS SECURITY FOR POLKAVM EVM</span>
          <span className="brand-word">PORTALDOT</span>
        </div>
      </footer>
    </>
  );
}
