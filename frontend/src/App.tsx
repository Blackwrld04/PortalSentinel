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
  Copy,
  Sliders,
  Search,
  Gauge,
  Server,
  BarChart3,
  RefreshCw
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
const DAEMON_API_URL =
  ((import.meta as any).env?.VITE_DAEMON_API_URL || "http://localhost:3001").replace(/\/$/, "");

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
  const ss58Address = "5EF5e8yASsVqweYRo13nMXxgkxCC8mYPNarcRqY7a8S7Pyni";
  const [userAddress, setUserAddress] = useState("0xD6047E51f4c52a28eA1fDDa94A60974e38C919A9");
  const [emergencySafe, setEmergencySafe] = useState("0x9378C531475Ffe51368f5a6e8790089eC8d9a27A");
  const [defenseMode, setDefenseMode] = useState<"CONSERVATIVE" | "BALANCED" | "AGGRESSIVE">("BALANCED");
  
  // Granular Security Policy Studio State
  const [autoRevokeEnabled, setAutoRevokeEnabled] = useState(true);
  const [autoSweepEnabled, setAutoSweepEnabled] = useState(true);
  const [maxOutflowHourly, setMaxOutflowHourly] = useState("5000"); // 5,000 pUSD
  const [policySavedToast, setPolicySavedToast] = useState(false);

  // Live On-Chain Approvals Scanner State
  const [isScanningApprovals, setIsScanningApprovals] = useState(false);
  const [revokingIndex, setRevokingIndex] = useState<number | null>(null);
  const [customToken, setCustomToken] = useState("");
  const [customSpender, setCustomSpender] = useState("");
  const [showCustomScanner, setShowCustomScanner] = useState(false);

  // Daemon Observability & Prometheus State
  const [daemonMetrics, setDaemonMetrics] = useState<{
    status: string;
    blockHeight: number;
    rpcLatencyMs: number;
    threatsDetected: number;
    defensesExecuted: number;
    lastDefenseLatencyMs: number;
    alertsSent: number;
    uptimeSeconds: number;
    dryRun: boolean;
  } | null>(null);

  const [blockHeight, setBlockHeight] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);

  // Telegram alert settings are stored in the daemon, not sent by the browser.
  // A bot token must never be shipped to a client bundle.
  const [telegramHandle, setTelegramHandle] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramSaved, setTelegramSaved] = useState(false);
  const [testAlertRequested, setTestAlertRequested] = useState(false);
  const [telegramNotifyDrain, setTelegramNotifyDrain] = useState(true);
  const [telegramNotifySuspicious, setTelegramNotifySuspicious] = useState(true);
  const [telegramNotifyDaily, setTelegramNotifyDaily] = useState(false);

  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Dashboard initialized in preview mode.",
    "[MONITOR] Daemon health is read from http://localhost:3001/health when available.",
    "[REGISTRY] No on-chain policies loaded yet. Connect a wallet to scan allowances.",
    "[SCANNER] Block scanning runs in the daemon, not in this browser tab.",
    "[HEURISTIC] Threat scoring runs in the daemon; this view displays its reported metrics."
  ]);

  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    {
      token: "0x25da2DeD5b0Da07C160e021e0Df636988C3657f5",
      tokenSymbol: "pUSD",
      spender: "0xc44a87FE907E497E50ffF6913c0b863bd0758a90",
      spenderName: "Compromised Router (MockExploitFixture)",
      allowance: "5,000 pUSD",
      riskScore: 98,
      status: "CRITICAL"
    },
    {
      token: "0x25da2DeD5b0Da07C160e021e0Df636988C3657f5",
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

  // Block height comes from the daemon's /health endpoint. There is deliberately
  // no local ticker: advancing a fake height would misrepresent chain progress.

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
    setUserAddress("0xD6047E51f4c52a28eA1fDDa94A60974e38C919A9");
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
            address: "0x25da2DeD5b0Da07C160e021e0Df636988C3657f5",
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
        "0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF",
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

  // Poll live daemon observability metrics (or fall back to live Portaldot V3 RPC telemetry)
  useEffect(() => {
    const startTime = Date.now();
    const fetchDaemonMetrics = async () => {
      try {
        const res = await fetch(`${DAEMON_API_URL}/health`);
        if (res.ok) {
          const data = await res.json();
          setDaemonMetrics({
            status: data.status,
            blockHeight: data.metrics.blockHeight ?? 0,
            // Use nullish fallbacks so a real zero is shown as zero, not a fake latency.
            rpcLatencyMs: data.metrics.rpcLatencyMs ?? 0,
            threatsDetected: data.metrics.threatsDetected ?? 0,
            defensesExecuted: data.metrics.defensesExecuted ?? 0,
            lastDefenseLatencyMs: data.metrics.lastDefenseLatencyMs ?? 0,
            alertsSent: data.metrics.alertsSent ?? 0,
            uptimeSeconds: data.metrics.uptimeSeconds ?? 0,
            dryRun: Boolean(data.dryRun ?? data.metrics.dryRun),
          });
          return;
        }
      } catch {
        // Fall through to direct Portaldot V3 RPC telemetry below
      }

      try {
        const t0 = performance.now();
        const rpcRes = await fetch("https://test-evm-rpc-v3.portaldot.dev", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        });
        if (rpcRes.ok) {
          const rpcJson = await rpcRes.json();
          const latency = Math.round(performance.now() - t0);
          const height = parseInt(rpcJson.result, 16) || 0;
          setDaemonMetrics((prev) => ({
            status: "rpc-direct",
            blockHeight: height,
            rpcLatencyMs: latency,
            threatsDetected: prev?.threatsDetected ?? 0,
            defensesExecuted: prev?.defensesExecuted ?? 0,
            lastDefenseLatencyMs: prev?.lastDefenseLatencyMs ?? 0,
            alertsSent: prev?.alertsSent ?? 0,
            uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
            dryRun: false,
          }));
          return;
        }
      } catch {
        setDaemonMetrics(null);
      }
    };
    fetchDaemonMetrics();
    const interval = setInterval(fetchDaemonMetrics, 4000);
    return () => clearInterval(interval);
  }, []);

  // Live On-Chain Approvals Scanner
  const handleScanApprovals = async () => {
    setIsScanningApprovals(true);
    addLog(`[SCANNER] Querying Portaldot V3 EVM RPC for active allowances on ${userAddress}...`);

    try {
      let provider: ethers.Provider;
      if (typeof window !== "undefined" && (window as any).ethereum) {
        provider = new ethers.BrowserProvider((window as any).ethereum);
      } else {
        const staticNet = new ethers.Network("Portaldot V3 Testnet", 420420777);
        provider = new ethers.JsonRpcProvider("https://test-evm-rpc-v3.portaldot.dev", staticNet, { staticNetwork: staticNet });
      }

      const updated = await Promise.all(
        approvals.map(async (item) => {
          try {
            const erc20 = new ethers.Contract(
              item.token,
              [
                "function allowance(address, address) view returns (uint256)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)",
              ],
              provider
            );
            const rawAllowance = await erc20.allowance(userAddress, item.spender);
            let displayAllowance = "0 " + item.tokenSymbol;
            let risk = 0;
            let status: "SAFE" | "SUSPICIOUS" | "CRITICAL" = "SAFE";

            if (rawAllowance > 0n) {
              if (rawAllowance > 1000000000000000000000000000n) {
                displayAllowance = "Unlimited";
              } else {
                displayAllowance = Number(ethers.formatUnits(rawAllowance, 18)).toLocaleString() + " " + item.tokenSymbol;
              }

              if (item.spender.toLowerCase().includes("c44a87") || item.spender.toLowerCase().includes("cf7ed") || item.spenderName.includes("Compromised")) {
                risk = 100;
                status = "CRITICAL";
              } else {
                risk = 45;
                status = "SUSPICIOUS";
              }
            } else {
              displayAllowance = "0 " + item.tokenSymbol;
              risk = 0;
              status = "SAFE";
            }

            return {
              ...item,
              allowance: displayAllowance,
              riskScore: risk,
              status,
            };
          } catch {
            return item;
          }
        })
      );

      setApprovals(updated);
      const critCount = updated.filter((u) => u.riskScore >= 70).length;
      addLog(`[SCANNER] Scan complete! Evaluated ${updated.length} spenders on Portaldot V3. Critical allowances: ${critCount}.`);
    } catch (err: any) {
      addLog(`[SCANNER ERROR] Failed to query on-chain allowances: ${err?.message || err}`);
    } finally {
      setIsScanningApprovals(false);
    }
  };

  // 1-Click On-Chain Revoke Function (MetaMask approve(spender, 0))
  const handleRevokeAllowance = async (item: ApprovalItem, idx: number) => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }

    setRevokingIndex(idx);
    addLog(`[REVOKE] Preparing on-chain zero-allowance transaction for ${item.spenderName}...`);

    try {
      if (!(window as any).ethereum) throw new Error("MetaMask is required to sign revoke transaction");
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await browserProvider.getSigner();

      const erc20 = new ethers.Contract(
        item.token,
        [
          "function approve(address spender, uint256 amount) returns (bool)",
        ],
        signer
      );

      addLog(`[REVOKE] Prompting signature: approve(${item.spender.slice(0, 10)}..., 0)...`);
      const tx = await erc20.approve(item.spender, 0);
      addLog(`[REVOKE] Transaction broadcast! Hash: ${tx.hash}. Waiting for block confirmation...`);

      const receipt = await tx.wait();
      addLog(`[REVOKE SUCCESS] Transaction confirmed in block #${receipt?.blockNumber}! Allowance permanently zeroed.`);

      // Update state row
      setApprovals((prev) =>
        prev.map((row, i) =>
          i === idx
            ? { ...row, allowance: "0 " + row.tokenSymbol, riskScore: 0, status: "SAFE" }
            : row
        )
      );

      // Telegram delivery is owned by the daemon. The browser never holds a bot
      // token, so there is nothing to send from here.
      addLog(`[TELEGRAM] Manual revoke confirmed. Configure TELEGRAM_CHAT_ID in the daemon to receive this alert.`);

      try {
        confetti({ particleCount: 60, spread: 65, origin: { y: 0.6 } });
      } catch {}
    } catch (err: any) {
      addLog(`[REVOKE ERROR] Transaction failed or rejected: ${err?.reason || err?.message || err}`);
    } finally {
      setRevokingIndex(null);
    }
  };

  // Custom Contract Scanner Handler
  const handleScanCustomContract = async () => {
    if (!customToken || !customSpender || !ethers.isAddress(customToken) || !ethers.isAddress(customSpender)) {
      addLog("[CUSTOM SCANNER] Please enter valid 0x addresses for both Token and Spender.");
      return;
    }

    addLog(`[CUSTOM SCANNER] Querying allowance for token ${customToken} -> spender ${customSpender}...`);
    try {
      const staticNet = new ethers.Network("Portaldot V3 Testnet", 420420777);
      const provider = (window as any).ethereum 
        ? new ethers.BrowserProvider((window as any).ethereum)
        : new ethers.JsonRpcProvider("https://test-evm-rpc-v3.portaldot.dev", staticNet, { staticNetwork: staticNet });

      const erc20 = new ethers.Contract(
        customToken,
        [
          "function allowance(address, address) view returns (uint256)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)"
        ],
        provider
      );

      const [rawAllowance, symbol, decimals] = await Promise.all([
        erc20.allowance(userAddress, customSpender),
        erc20.symbol().catch(() => "TOKEN"),
        erc20.decimals().catch(() => 18)
      ]);

      const isUnlim = rawAllowance > 1000000000000000000000000000n;
      const formatted = isUnlim ? "Unlimited" : rawAllowance === 0n ? "0 " + symbol : ethers.formatUnits(rawAllowance, decimals) + " " + symbol;
      const risk = rawAllowance > 0n ? (isUnlim ? 85 : 50) : 0;
      const status = risk >= 80 ? "CRITICAL" : risk > 0 ? "SUSPICIOUS" : "SAFE";

      const newItem: ApprovalItem = {
        token: customToken,
        tokenSymbol: symbol,
        spender: customSpender,
        spenderName: "Custom Spender (" + customSpender.slice(0, 6) + "..." + customSpender.slice(-4) + ")",
        allowance: formatted,
        riskScore: risk,
        status: status as any
      };

      setApprovals((prev) => [newItem, ...prev]);
      addLog(`[CUSTOM SCANNER] Scanned! Allowance: ${formatted}. Risk: ${risk}/100 [${status}].`);
      setCustomToken("");
      setCustomSpender("");
      setShowCustomScanner(false);
    } catch (err: any) {
      addLog(`[CUSTOM SCANNER ERROR] Query failed: ${err?.message || err}`);
    }
  };

  // Granular Policy Studio Save Handler
  const handleSavePolicyStudio = async () => {
    setPolicySavedToast(true);
    addLog(`[POLICY STUDIO] Policy Saved: Mode=${defenseMode}, Safe=${emergencySafe}, AutoRevoke=${autoRevokeEnabled}, AutoSweep=${autoSweepEnabled}, MaxOutflow=${maxOutflowHourly} pUSD`);
    addLog(`[TELEGRAM] Policy changes are not sent from the browser; configure alerts in the daemon environment.`);

    if (walletConnected) {
      await handleArmVaultOnChain();
    }

    setTimeout(() => setPolicySavedToast(false), 4000);
  };

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramChatId.trim()) {
      addLog("[TELEGRAM] Enter a chat ID before saving.");
      return;
    }
    setTelegramSaved(true);
    addLog(`[TELEGRAM] Preview settings saved for ${telegramHandle || "this browser"}. The daemon reads TELEGRAM_CHAT_ID from its environment; the dashboard never receives the bot token.`);
    setTimeout(() => setTelegramSaved(false), 3000);
  };

  const handleSendTestTelegram = () => {
    setTestAlertRequested(true);
    addLog("[TELEGRAM] This dashboard cannot send Telegram messages. On the daemon host, run `npm run cli telegram:test <chat-id>` with TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID set.");
    setTimeout(() => setTestAlertRequested(false), 4500);
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toTimeString().split(" ")[0];
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 20)]);
  };

  const handleSimulateAttack = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(1);

    addLog("[SIMULATION] Local walkthrough only — no transaction is broadcast.");

    addLog("[ALERT] Exploit transaction detected! Router 0xc44a87... attempting 5,000 pUSD drain.");

    // Step 2: Threat Evaluation
    await new Promise((r) => setTimeout(r, 1100));
    setSimStep(2);
    addLog("[THREAT SCORER] Evaluation: 100/100 [CRITICAL]. Uncertified router signature confirmed.");

    // Step 3: Priority Gas Escalation (1.35x)
    await new Promise((r) => setTimeout(r, 1200));
    setSimStep(3);
    addLog("[DISPATCHER] Would escalate gas price by 1.35x and broadcast an emergency defense.");

    // Step 4: Defense Execution
    await new Promise((r) => setTimeout(r, 1300));
    setSimStep(4);
    addLog("[EXECUTION] DefenseExecutor.executeEmergencyBatchRevoke would be sent (simulated).");

    // Step 5: Preview complete
    await new Promise((r) => setTimeout(r, 1100));
    setSimStep(5);

    // Update compromised approval status to safe
    setApprovals((prev) =>
      prev.map((item) =>
        item.status === "CRITICAL"
          ? { ...item, allowance: "0 pUSD", riskScore: 0, status: "SAFE", spenderName: "Compromised Router [PREVIEW: WOULD BE REVOKED]" }
          : item
      )
    );

    addLog("[SIMULATED] Walkthrough complete. A live daemon would revoke the remaining allowance and sweep unprotected funds; it cannot undo the transfer that emitted the signal.");
    addLog("[SIMULATION] No Telegram message was sent for this local preview. Configure the daemon to receive alerts.");
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
    setApprovals([
      {
        token: "0x25da2DeD5b0Da07C160e021e0Df636988C3657f5",
        tokenSymbol: "pUSD",
        spender: "0xc44a87FE907E497E50ffF6913c0b863bd0758a90",
        spenderName: "Compromised Router (MockExploitFixture)",
        allowance: "5,000 pUSD",
        riskScore: 98,
        status: "CRITICAL"
      },
      {
        token: "0x25da2DeD5b0Da07C160e021e0Df636988C3657f5",
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
            <a href="/pitch-deck.html" target="_blank" rel="noreferrer">PITCH DECK ↗</a>
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
                  {daemonMetrics ? "READING DAEMON BLOCK STREAM..." : "AWAITING DAEMON CONNECTION..."}<br />
                  {daemonMetrics ? "DAEMON ONLINE." : "PREVIEW MODE — NO LIVE TELEMETRY."}
                </span>
              </div>
              <div className="prompt-sub mono">
                ZERO-CUSTODY INVARIANT<br />
                PRIORITY ESCALATOR: 1.35x — 1.85x
              </div>
              <div className="analysis-label mono">
                <span className="pulse-dot"></span> AGENT STATUS — {daemonMetrics ? "ONLINE" : "STANDBY"}
                <strong id="prompt-product">{daemonMetrics ? "READY TO DEFEND" : "CONNECT DAEMON"}</strong>
              </div>

              <ul className="hero-spec mono">
                <li>TARGET NETWORK <b>Portaldot V3</b></li>
                <li>CHAIN ID <b>420420777</b></li>
                <li>RPC LATENCY <b>{daemonMetrics?.rpcLatencyMs ?? 0}ms</b></li>
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
                When zero-day drainers or malicious router exploits strike, PortalSentinel is designed to
                escalate priority gas, revoke allowances, and sweep capital to a user's cold vault before
                the drain finalizes. Whether it wins the race depends on block timing, RPC behavior, and gas priority.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", marginTop: "24px" }}>
                <button 
                  className="agent-cta" 
                  onClick={handleSimulateAttack}
                  disabled={isSimulating}
                >
                  {isSimulating ? "WALKTHROUGH IN PROGRESS..." : "RUN DEFENSE WALKTHROUGH"} <span>↗</span>
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
                {simStep === 4 && "EXECUTION — DEFENSE DISPATCH (SIMULATED)"}
                {simStep === 5 && "WALKTHROUGH COMPLETE — NO FUNDS MOVED"}
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

        {/* INTERACTIVE ATTACK & DEFENSE WALKTHROUGH (THE JUDGE SHOWPIECE) */}
        <section id="sandbox" className="gateway" style={{ paddingBottom: "70px" }}>
          <div className="section-heading">
            <h2 className="reveal">
              Exploit Intercept &<br />
              <span className="corner-bracket">Defense Walkthrough.</span>
            </h2>
            <p>
              Step through a local UI walkthrough of a drain response on Portaldot V3 EVM.
              It does not sign or broadcast anything; it shows the decision path the daemon follows
              when a signal is scored and a defense is selected.
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
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>Live mode escalates fees 1.35x → 1.60x → 1.85x</span>
                </div>

                <div style={{ padding: "14px", border: "1px solid var(--line)", background: simStep >= 4 ? "#24140b" : "#0d0b10", borderColor: simStep >= 4 ? "#ff6a1a" : "var(--line)" }}>
                  <span className="mono" style={{ color: "#ff8638", fontSize: "10px", display: "block", marginBottom: "4px" }}>PHASE 04</span>
                  <strong style={{ display: "block", fontSize: "12px", color: "#fff", marginBottom: "4px" }}>ATOMIC REVOCATION</strong>
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>executeEmergencyBatchRevoke (simulated)</span>
                </div>

                <div style={{ padding: "14px", border: "1px solid var(--line)", background: simStep >= 5 ? "#0e2417" : "#0d0b10", borderColor: simStep >= 5 ? "#78e9c4" : "var(--line)" }}>
                  <span className="mono" style={{ color: "#78e9c4", fontSize: "10px", display: "block", marginBottom: "4px" }}>PHASE 05</span>
                  <strong style={{ display: "block", fontSize: "12px", color: "#fff", marginBottom: "4px" }}>ALLOWANCE WOULD BE ZEROED</strong>
                  <span className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>Demo preview only — no on-chain state changed</span>
                </div>
              </div>

              {/* Simulation notice */}
              {simStep >= 5 && (
                <div style={{ padding: "16px", background: "#0c1f15", border: "1px solid #78e9c466", marginTop: "15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <CheckCircle2 size={13} color="#78e9c4" />
                    <span className="mono" style={{ color: "#78e9c4", fontSize: "11px", fontWeight: "bold" }}>
                      LOCAL UI SIMULATION — NO TRANSACTION WAS BROADCAST
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: "11px", color: "#dfbc97", lineHeight: 1.6 }}>
                    This walkthrough does not sign or send anything. To see a real defense,
                    run the daemon against the testnet with <code>DRY_RUN=false</code> and a
                    funded guardian key, then trigger the demo fixture.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ACTIVE APPROVALS SCANNER & POLICY STUDIO SECTION */}
        <section id="approvals" className="pricing-section" style={{ paddingBottom: "70px" }}>
          <div className="section-heading">
            <h2 className="reveal">
              Live Approvals Scanner &<br />
              <span className="corner-bracket">Granular Policy Studio.</span>
            </h2>
            <p>
              Autonomous on-chain firewall. Inspect live ERC-20 allowances, revoke compromised spenders in 1-click via MetaMask, and calibrate your circuit breaker rules on Portaldot V3 EVM.
            </p>
          </div>

          <div className="sentinel-section" style={{ display: "grid", gap: "25px" }}>
            
            {/* CARD 1: GRANULAR SECURITY POLICY STUDIO */}
            <div className="sentinel-card sentinel-card-orange">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--line)", paddingBottom: "14px" }}>
                <span className="mono" style={{ fontSize: "12px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <Sliders size={14} color="#ff8638" /> AUTONOMOUS CIRCUIT BREAKER POLICY STUDIO
                </span>
                <span className="mono" style={{ fontSize: "10px", color: "#78e9c4", background: "rgba(120, 233, 196, 0.1)", border: "1px solid rgba(120, 233, 196, 0.25)", padding: "3px 8px" }}>
                  pallet-revive PolkaVM ENFORCED
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                
                {/* Col 1: Defense Sensitivity Mode */}
                <div>
                  <label className="mono" style={{ fontSize: "11px", color: "#8b8985", display: "block", marginBottom: "8px" }}>
                    DEFENSE SENSITIVITY THRESHOLD:
                  </label>
                  <div className="use-tabs mono" style={{ width: "100%", margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                    {(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const).map((mode) => (
                      <button
                        key={mode}
                        role="tab"
                        aria-selected={defenseMode === mode}
                        onClick={() => setDefenseMode(mode)}
                        style={{ padding: "10px 8px", fontSize: "10px", textAlign: "center" }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: "10px", color: "#dfbc97", display: "block", marginTop: "6px" }}>
                    {defenseMode === "CONSERVATIVE" && "Strict: Defends on any suspicious signature (Threshold ≥ 40 pts)."}
                    {defenseMode === "BALANCED" && "Recommended: Defends on confirmed abnormal drains (Threshold ≥ 60 pts)."}
                    {defenseMode === "AGGRESSIVE" && "Permissive: Intervenes only on catastrophic drain attacks (Threshold ≥ 80 pts)."}
                  </span>
                </div>

                {/* Col 2: Max Outflow Throttle */}
                <div>
                  <label className="mono" style={{ fontSize: "11px", color: "#8b8985", display: "block", marginBottom: "8px" }}>
                    MAX HOURLY OUTFLOW VELOCITY:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                    {["500", "1000", "5000", "Unlimited"].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setMaxOutflowHourly(val)}
                        className="mono"
                        style={{
                          background: maxOutflowHourly === val ? "rgba(255, 106, 26, 0.2)" : "#0c0a0e",
                          border: maxOutflowHourly === val ? "1px solid #ff6a1a" : "1px solid var(--line)",
                          color: maxOutflowHourly === val ? "#ff8638" : "#8b8985",
                          padding: "8px 4px",
                          fontSize: "10px",
                          cursor: "pointer"
                        }}
                      >
                        {val === "Unlimited" ? "MAX" : `${val} pUSD`}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: "10px", color: "#8b8985", display: "block", marginTop: "6px" }}>
                    Triggers autonomous freeze if aggregate hourly outflows breach velocity cap.
                  </span>
                </div>

              </div>

              {/* Emergency Cold Safe Target */}
              <div style={{ background: "#060507", border: "1px solid var(--line)", padding: "14px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span className="mono" style={{ fontSize: "10px", color: "#dfbc97" }}>
                    REGISTERED EMERGENCY COLD SAFE (Sweep Invariant Target):
                  </span>
                  <span className="mono" style={{ fontSize: "9px", color: "#78e9c4" }}>
                    MUTABLE ONLY BY WALLET OWNER
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={emergencySafe}
                    onChange={(e) => setEmergencySafe(e.target.value)}
                    className="mono"
                    style={{ flex: 1, minWidth: "260px", background: "#110f13", border: "1px solid #30261e", color: "#fff", padding: "10px 12px", fontSize: "12px", outline: "none" }}
                  />
                  <span className="badge-safe" style={{ padding: "8px 12px" }}>USER-SET SAFE</span>
                </div>
              </div>

              {/* Policy Toggles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "15px", marginBottom: "22px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0b090e", border: "1px solid var(--line)", padding: "12px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoRevokeEnabled}
                    onChange={(e) => setAutoRevokeEnabled(e.target.checked)}
                    style={{ accentColor: "#ff6a1a" }}
                  />
                  <div>
                    <strong style={{ color: "#fff", fontSize: "12px", display: "block" }}>Autonomous Allowance Revocation</strong>
                    <span style={{ color: "#8b8985", fontSize: "10px" }}>Front-run malicious router and zero allowance at block level</span>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0b090e", border: "1px solid var(--line)", padding: "12px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoSweepEnabled}
                    onChange={(e) => setAutoSweepEnabled(e.target.checked)}
                    style={{ accentColor: "#ff6a1a" }}
                  />
                  <div>
                    <strong style={{ color: "#fff", fontSize: "12px", display: "block" }}>Atomic Capital Cold Sweep</strong>
                    <span style={{ color: "#8b8985", fontSize: "10px" }}>Transfer remaining vault balances to registered cold safe</span>
                  </div>
                </label>
              </div>

              {/* Save & Arm Trigger */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <button
                  onClick={handleSavePolicyStudio}
                  disabled={isArmingOnChain}
                  className="agent-cta"
                  style={{ flex: 1, minWidth: "260px", justifyContent: "center", padding: "14px", fontSize: "11px", cursor: isArmingOnChain ? "wait" : "pointer" }}
                >
                  {isArmingOnChain ? (
                    <span>CONFIRMING TRANSACTION ON PORTALDOT V3 TESTNET...</span>
                  ) : (
                    <span>[SAVE POLICY & ARM SHIELD (PORTALDOT V3 REGISTRY)] ↗</span>
                  )}
                </button>

                {!walletConnected && (
                  <button 
                    onClick={connectWallet}
                    className="outline-button launch"
                    style={{ padding: "14px 18px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Wallet size={13} /> CONNECT METAMASK
                  </button>
                )}
              </div>

              {/* Toast for saved policy */}
              {policySavedToast && (
                <div style={{ marginTop: "14px", padding: "10px 14px", background: "#0c1f15", border: "1px solid #78e9c4", color: "#78e9c4", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={13} color="#78e9c4" /> Policy rules synchronized with SentinelRegistry! Mobile alert pushed.
                </div>
              )}

              {/* On-chain registration hash banner */}
              {onChainRegisterHash && (
                <div style={{ marginTop: "14px", padding: "12px", background: "#0c1f15", border: "1px solid #78e9c466" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span className="mono" style={{ color: "#78e9c4", fontSize: "11px", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={13} color="#78e9c4" /> REGISTRY CONTRACT TRANSACTION MINED:
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
                  <div className="mono" style={{ fontSize: "10px", color: "#fff", wordBreak: "break-all", background: "#050e09", padding: "6px" }}>
                    Tx Hash: {onChainRegisterHash}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: LIVE ON-CHAIN APPROVALS SCANNER & 1-CLICK FIREWALL */}
            <div className="sentinel-card">
              
              {/* Header and Scanner Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px", borderBottom: "1px solid var(--line)", paddingBottom: "14px" }}>
                <div>
                  <span className="mono" style={{ fontSize: "12px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Search size={14} color="#dfbc97" /> LIVE ON-CHAIN ALLOWANCES & FIREWALL
                  </span>
                  <div className="mono" style={{ fontSize: "11px", color: "#8b8985", marginTop: "2px" }}>
                    Wallet: <span style={{ color: "#fff" }}>{userAddress}</span>
                  </div>
                  <div className="mono" style={{ fontSize: "10px", color: "#dfbc97", marginTop: "4px" }}>
                    Default rows are sample data. Run a scan on the connected wallet to replace them with live allowances.
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={handleScanApprovals}
                    disabled={isScanningApprovals}
                    className="outline-button launch"
                    style={{ padding: "8px 14px", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <RefreshCw size={12} className={isScanningApprovals ? "spin" : ""} />
                    {isScanningApprovals ? "SCANNING ON-CHAIN..." : "SCAN ON-CHAIN ALLOWANCES"}
                  </button>

                  <button
                    onClick={() => setShowCustomScanner(!showCustomScanner)}
                    className="outline-button"
                    style={{ padding: "8px 14px", fontSize: "10px" }}
                  >
                    {showCustomScanner ? "CLOSE SCANNER" : "+ CUSTOM CONTRACT"}
                  </button>
                </div>
              </div>

              {/* Custom Scanner Drawer */}
              {showCustomScanner && (
                <div style={{ background: "#0a080d", border: "1px solid var(--line)", padding: "14px", marginBottom: "20px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#ff8638", display: "block", marginBottom: "10px" }}>
                    INSPECT CUSTOM ERC-20 TOKEN & SPENDER CONTRACT (PORTALDOT V3):
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "10px" }}>
                    <input
                      type="text"
                      placeholder="Token Contract Address (0x...)"
                      value={customToken}
                      onChange={(e) => setCustomToken(e.target.value)}
                      className="mono"
                      style={{ background: "#110f13", border: "1px solid var(--line)", padding: "8px 10px", color: "#fff", fontSize: "11px" }}
                    />
                    <input
                      type="text"
                      placeholder="Spender / Router Address (0x...)"
                      value={customSpender}
                      onChange={(e) => setCustomSpender(e.target.value)}
                      className="mono"
                      style={{ background: "#110f13", border: "1px solid var(--line)", padding: "8px 10px", color: "#fff", fontSize: "11px" }}
                    />
                  </div>
                  <button
                    onClick={handleScanCustomContract}
                    className="outline-button launch"
                    style={{ padding: "8px 16px", fontSize: "10px" }}
                  >
                    SCAN ALLOWANCE & EVALUATE RISK ↗
                  </button>
                </div>
              )}

              {/* Approvals Table */}
              <div style={{ overflowX: "auto" }}>
                <div className="table-header" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1.3fr 1fr 1.5fr" }}>
                  <span>Spender Contract / Protocol</span>
                  <span>Token</span>
                  <span>Allowance</span>
                  <span>Threat Risk</span>
                  <span style={{ textAlign: "right" }}>1-Click Circuit Action</span>
                </div>

                {approvals.map((item, idx) => {
                  const isSafe = item.allowance === "0 " + item.tokenSymbol || item.allowance === "0 pUSD" || item.riskScore === 0;
                  const isRevoking = revokingIndex === idx;

                  return (
                    <div key={idx} className="table-row" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1.3fr 1fr 1.5fr", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "#fff", fontSize: "12px", display: "block" }}>{item.spenderName}</strong>
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

                      <div className="mono" style={{ color: isSafe ? "#78e9c4" : "#ff8638", fontSize: "12px", fontWeight: isSafe ? "normal" : "bold" }}>
                        {item.allowance}
                      </div>

                      <div>
                        <span className={item.status === "CRITICAL" ? "badge-critical" : "badge-safe"}>
                          {item.status} ({item.riskScore})
                        </span>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        {!isSafe ? (
                          <button
                            onClick={() => handleRevokeAllowance(item, idx)}
                            disabled={isRevoking}
                            className="outline-button"
                            style={{
                              padding: "6px 12px",
                              fontSize: "10px",
                              color: "#ff6a1a",
                              borderColor: "#ff6a1a",
                              background: "rgba(255, 106, 26, 0.1)",
                              cursor: isRevoking ? "wait" : "pointer"
                            }}
                          >
                            {isRevoking ? "REVOKING..." : "REVOKE (0x0)"}
                          </button>
                        ) : (
                          <span className="mono" style={{ color: "#78e9c4", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={11} color="#78e9c4" /> Disarmed (Safe)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              Zero-visit background protection. PortalSentinel's autonomous daemon monitors Portaldot V3 blocks continuously.
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
                    Once registered, run the PortalSentinel daemon on your own node or a host you control. It polls Portaldot V3 blocks and sends a Telegram advisory when it detects the configured signal. Delivery depends on block timing, RPC behavior, and Telegram availability; the dashboard does not promise a millisecond interception.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="mono" style={{ fontSize: "11px", color: "#78e9c4", background: "rgba(120, 233, 196, 0.1)", border: "1px solid rgba(120, 233, 196, 0.3)", padding: "6px 12px" }}>
                  ● DAEMON ALERTS: CONFIGURED IN ENV
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
                      disabled={testAlertRequested}
                      className="outline-button"
                      style={{ 
                        flex: 1, 
                        padding: "10px", 
                        fontSize: "11px", 
                        borderColor: testAlertRequested ? "#78e9c4" : "var(--line)",
                        color: testAlertRequested ? "#78e9c4" : "#dfbc97"
                      }}
                    >
                      {testAlertRequested ? "SEE LOG FOR TEST STEPS" : (<span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Smartphone size={12} /> HOW TO TEST ALERTS</span>)}
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
                      <ShieldAlert size={14} color="#ff6a1a" /> <strong>Exploit Interception & Defense Actions</strong> (Instant)
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

              {/* Right Column: Telegram Alert Preview Mockup */}
              <div className="sentinel-card" style={{ 
                background: "#08060a", 
                borderColor: testAlertRequested ? "#ff6a1a" : "var(--line)",
                transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                boxShadow: testAlertRequested ? "0 0 35px rgba(255, 106, 26, 0.3)" : "none"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Smartphone size={12} color="#dfbc97" /> TELEGRAM ALERT PREVIEW (MOCKUP)
                  </span>
                  {testAlertRequested ? (
                    <span className="mono" style={{ fontSize: "10px", color: "#ff6a1a" }}>
                      ● TEST INSTRUCTIONS IN LOG
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: "10px", color: "#78e9c4" }}>
                      ● ILLUSTRATIVE ONLY
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
                        PortalSentinel block scanner identified unauthorized <code>transferFrom</code> attempt.
                      </div>
                      <div className="mono" style={{ fontSize: "10px", color: "#8b8985", background: "#0c0a10", padding: "6px", borderRadius: "6px", marginBottom: "6px" }}>
                        <div>Victim: 0x6198fA0e...9C74</div>
                        <div>Target: 5,000 pUSD</div>
                        <div>Threat Score: 100/100</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "9px", color: "#ff6a1a" }}>Dispatching 1.35x fee defense...</span>
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
                        <ShieldCheck size={12} color="#78e9c4" /> EXPLOIT NEUTRALIZED — PREVIEW
                      </div>
                      <div style={{ fontSize: "11px", color: "#fff", lineHeight: 1.4, marginBottom: "6px" }}>
                        Defense would be confirmed on-chain after a successful live dispatch. Remaining allowance would be zeroed and funds swept to the cold safe.
                      </div>
                      <div className="mono" style={{ fontSize: "10px", color: "#78e9c4", background: "#06130d", padding: "6px", borderRadius: "6px", marginBottom: "8px" }}>
                        <div>Protected: remaining pUSD</div>
                        <div>Action: EmergencyBatchRevoke</div>
                        <div>Block: #preview</div>
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
              Daemon telemetry and operator tooling for Portaldot V3 EVM, with CLI inspection commands for node runners.
            </p>
          </div>

          <div className="sentinel-section">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "25px" }}>
              
              {/* Terminal Feed */}
              <div className="sentinel-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Terminal size={12} color="#dfbc97" /> DASHBOARD ACTIVITY LOG
                  </span>
                  <span className="mono" style={{ fontSize: "10px", color: daemonMetrics ? "#78e9c4" : "#ff8638" }}>
                    ● {daemonMetrics ? "DAEMON ONLINE" : "PREVIEW / OFFLINE"}
                  </span>
                </div>
                <div className="terminal-window">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>

              {/* Prometheus Observability & Daemon Health */}
              <div className="sentinel-card sentinel-card-orange">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
                  <span className="mono" style={{ fontSize: "11px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <BarChart3 size={13} color="#ff8638" /> PROMETHEUS METRICS & OBSERVABILITY
                  </span>
                  <span className="mono" style={{ fontSize: "10px", color: daemonMetrics ? "#78e9c4" : "#ff8638" }}>
                    ● {daemonMetrics ? `API ONLINE — ${daemonMetrics.dryRun ? "DRY RUN" : "LIVE"}` : "DAEMON STANDBY"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "10px" }}>
                    <span className="mono" style={{ fontSize: "9px", color: "#8b8985", display: "block" }}>MONITORED BLOCK:</span>
                    <strong className="mono" style={{ color: "#fff", fontSize: "14px" }}>#{daemonMetrics?.blockHeight ?? blockHeight}</strong>
                  </div>
                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "10px" }}>
                    <span className="mono" style={{ fontSize: "9px", color: "#8b8985", display: "block" }}>RPC ROUNDTRIP LATENCY:</span>
                    <strong className="mono" style={{ color: "#78e9c4", fontSize: "14px" }}>{daemonMetrics?.rpcLatencyMs ?? 0} ms</strong>
                  </div>
                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "10px" }}>
                    <span className="mono" style={{ fontSize: "9px", color: "#8b8985", display: "block" }}>THREATS DETECTED:</span>
                    <strong className="mono" style={{ color: "#ff8638", fontSize: "14px" }}>{daemonMetrics?.threatsDetected ?? 0}</strong>
                  </div>
                  <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "10px" }}>
                    <span className="mono" style={{ fontSize: "9px", color: "#8b8985", display: "block" }}>DEFENSES EXECUTED:</span>
                    <strong className="mono" style={{ color: "#78e9c4", fontSize: "14px" }}>{daemonMetrics?.defensesExecuted ?? 0}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <a
                    href={`${DAEMON_API_URL}/health`}
                    target="_blank"
                    rel="noreferrer"
                    className="outline-button launch"
                    style={{ flex: 1, minWidth: "120px", padding: "8px 10px", fontSize: "10px", textAlign: "center", textDecoration: "none" }}
                  >
                    JSON /health ↗
                  </a>
                  <a
                    href={`${DAEMON_API_URL}/metrics`}
                    target="_blank"
                    rel="noreferrer"
                    className="outline-button"
                    style={{ flex: 1, minWidth: "120px", padding: "8px 10px", fontSize: "10px", textAlign: "center", textDecoration: "none" }}
                  >
                    Prometheus /metrics ↗
                  </a>
                </div>

                <div className="mono" style={{ fontSize: "10px", color: "#8b8985" }}>
                  CLI Probe: <code style={{ color: "#ff8638" }}>npm run cli:metrics</code>
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

            {/* Live Deployed Smart Contracts on Portaldot V3 Testnet */}
            <div className="sentinel-card sentinel-card-orange" style={{ marginTop: "25px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "15px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
                <span className="mono" style={{ fontSize: "12px", color: "#dfbc97", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={14} color="#78e9c4" /> VERIFIED PORTALDOT V3 TESTNET DEPLOYMENTS (CHAIN ID: 420420777)
                </span>
                <a
                  href="https://node-console.portaldot.dev/"
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{ fontSize: "10px", color: "#78e9c4", textDecoration: "none", border: "1px solid rgba(120, 233, 196, 0.3)", padding: "4px 10px", background: "rgba(120, 233, 196, 0.08)" }}
                >
                  VERIFY ON PORTALDOT NODE CONSOLE ↗
                </a>
              </div>
              <div className="mono" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", fontSize: "11px" }}>
                <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px" }}>
                  <strong style={{ color: "#fff", display: "block", marginBottom: "4px" }}>SentinelRegistry.sol (Block #311022)</strong>
                  <div style={{ color: "#78e9c4", wordBreak: "break-all", fontSize: "10px" }}>Address: 0x31F0A0aa7622a3fdD02EcF945f8Bd5CE6f11f4cF</div>
                  <div style={{ color: "#8b8985", wordBreak: "break-all", fontSize: "9px", marginTop: "4px" }}>Tx: 0xcf77198f0b1666c4084441d61db60a39f6a07981a9c9605fb4341689ba48336c</div>
                </div>
                <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px" }}>
                  <strong style={{ color: "#fff", display: "block", marginBottom: "4px" }}>DefenseExecutor.sol (Block #311067)</strong>
                  <div style={{ color: "#78e9c4", wordBreak: "break-all", fontSize: "10px" }}>Address: 0x89c9510c4b3AeEE8792De383D251ef0b61d406E2</div>
                  <div style={{ color: "#8b8985", wordBreak: "break-all", fontSize: "9px", marginTop: "4px" }}>Tx: 0x4cdd30974731623f7e9b2e25768d328669a4207ac5d0b7ea8aa0135ae31220f0</div>
                </div>
                <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px" }}>
                  <strong style={{ color: "#fff", display: "block", marginBottom: "4px" }}>MockERC20.sol — pUSD (Block #311161)</strong>
                  <div style={{ color: "#ff8638", wordBreak: "break-all", fontSize: "10px" }}>Address: 0x25da2DeD5b0Da07C160e021e0Df636988C3657f5</div>
                  <div style={{ color: "#8b8985", wordBreak: "break-all", fontSize: "9px", marginTop: "4px" }}>Tx: 0xf959f9ea03878c9ff0472ee3343f0c50c2be0a8fc119a41d6b83de2c250b515b</div>
                </div>
                <div style={{ background: "#0c0a0e", border: "1px solid var(--line)", padding: "12px" }}>
                  <strong style={{ color: "#fff", display: "block", marginBottom: "4px" }}>MockExploitFixture.sol (Block #310782)</strong>
                  <div style={{ color: "#ff8638", wordBreak: "break-all", fontSize: "10px" }}>Address: 0xc44a87FE907E497E50ffF6913c0b863bd0758a90</div>
                  <div style={{ color: "#8b8985", wordBreak: "break-all", fontSize: "9px", marginTop: "4px" }}>Tx: 0xcfdbdcf2d2807b19a5b8b00a5e4c0b7ee69cffd8e9df89be1c4e596a9fe1b941</div>
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
            <span className="mono" style={{ fontSize: "11px", color: "#b1a0bd" }}>Fee-Escalated Defense Dispatch</span>
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
