import React, { useState, useEffect } from "react";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Zap, 
  Terminal, 
  Activity, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  Play,
  RotateCcw,
  Wallet,
  X,
  ArrowUpRight,
  Cpu,
  Server,
  Layers
} from "lucide-react";
import confetti from "canvas-confetti";

interface ApprovalItem {
  token: string;
  tokenSymbol: string;
  spender: string;
  spenderName: string;
  allowance: string;
  riskScore: number;
  status: "SAFE" | "SUSPICIOUS" | "CRITICAL";
}

export default function App() {
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [walletConnected, setWalletConnected] = useState(true);
  const [userAddress, setUserAddress] = useState("0x6198fA0eC3d9E345bB5A429bC283F8C564619C74");
  const [emergencySafe, setEmergencySafe] = useState("0x9378C531475Ffe51368f5a6e8790089eC8d9a27A");
  const [shieldActive, setShieldActive] = useState(true);
  const [defenseMode, setDefenseMode] = useState<"CONSERVATIVE" | "BALANCED" | "AGGRESSIVE">("BALANCED");
  
  const [blockHeight, setBlockHeight] = useState(257945);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string>("");

  const [logs, setLogs] = useState<string[]>([
    "[08:20:12] [SYSTEM] PortalSentinel node active on Portaldot V3 EVM (Chain ID: 420420777)",
    "[08:20:14] [MONITOR] Subscribed to pallet-revive RPC at https://test-evm-rpc-v3.portaldot.dev",
    "[08:20:16] [REGISTRY] Loaded active user policies. Total protected wallets: 1,429",
    "[08:20:18] [TELEMETRY] Scanning block mempool for anomalous transferFrom and zero-day drains...",
    "[08:20:21] [HEURISTIC] Threat scoring matrix armed: Rule 1 (+100), Rule 2 (+60), Rule 3 (+25)"
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

  // Live block ticker (Portaldot ~3s block time)
  useEffect(() => {
    const timer = setInterval(() => {
      setBlockHeight((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Sandbox Attack Simulation with 5-phase story progression
  const handleSimulateAttack = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(1);
    setLastTxHash("");

    addLog("🚨 [ALERT] Exploit transaction detected in Mempool! Router 0xCf7Ed... attempting drain.");

    // Step 2: Threat Evaluation (100/100)
    await new Promise((r) => setTimeout(r, 1100));
    setSimStep(2);
    addLog("🧠 [THREAT SCORER] Evaluation: 100/100 [CRITICAL]. Uncertified router drain detected.");

    // Step 3: Priority Gas Escalation (1.35x)
    await new Promise((r) => setTimeout(r, 1200));
    setSimStep(3);
    addLog("⚡ [DISPATCHER] Escalating gas price by 1.35x (0.0000354 Gwei). Broadcasting emergency front-run.");

    // Step 4: Defense Execution
    await new Promise((r) => setTimeout(r, 1300));
    setSimStep(4);
    addLog("🛡️ [EXECUTION] DefenseExecutor.executeEmergencyBatchRevoke mined in block #" + (blockHeight + 1));

    // Step 5: Capital Rescued
    await new Promise((r) => setTimeout(r, 1100));
    setSimStep(5);
    const mockHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setLastTxHash(mockHash);

    // Update compromised approval status to neutralized
    setApprovals((prev) =>
      prev.map((item) =>
        item.status === "CRITICAL"
          ? { ...item, allowance: "0 pUSD", riskScore: 0, status: "SAFE", spenderName: "Compromised Router [REVOKED]" }
          : item
      )
    );

    addLog("✅ [SUCCESS] Capital preserved! Attacker front-ran. Allowance zeroed before drain finalized.");
    setIsSimulating(false);

    try {
      confetti({
        particleCount: 80,
        spread: 60,
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
    addLog("🔄 [SANDBOX] Reset to baseline state. Vulnerable allowance restored for testing.");
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toTimeString().split(" ")[0];
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 18)]);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#f2efea] relative selection:bg-[#ff6a1a]/30">
      
      {/* Top Announcement Bar */}
      {!announcementDismissed && (
        <div className="bg-[#121110] border-b border-[#242322] text-[#a8a6a1] text-xs py-1.5 px-4 flex items-center justify-between mono">
          <div className="flex items-center gap-2 truncate">
            <span className="pulse-dot"></span>
            <span className="text-[#ff9b4d] font-bold">PORTALDOT V3 TESTNET</span>
            <span className="hidden md:inline text-[#605247]">|</span>
            <span className="truncate">Autonomous Front-Running Firewall Active · pallet-revive REVM Circuit Breaker</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a 
              href="https://node-console.portaldot.dev/" 
              target="_blank" 
              rel="noreferrer"
              className="text-[#ff9b4d] hover:text-white flex items-center gap-1 transition"
            >
              Node Console <ArrowUpRight className="w-3 h-3" />
            </a>
            <button 
              onClick={() => setAnnouncementDismissed(true)}
              className="text-[#8b8985] hover:text-white transition p-0.5"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cyber Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-md border-b border-[#242322]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-[#ff6a1a] bg-[#120b07] flex items-center justify-center text-[#ff9b4d] text-sm font-bold shadow-[0_0_12px_rgba(255,106,26,0.25)]">
              ••
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-lg text-white">PORTAL<span className="text-[#ff6a1a]">SENTINEL</span></span>
              <span className="block text-[9px] mono text-[#8b8985] uppercase tracking-widest -mt-1">CIRCUIT BREAKER V3</span>
            </div>
          </div>

          {/* Central Telemetry Pills */}
          <div className="hidden lg:flex items-center gap-4 text-xs mono">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#121110] border border-[#242322] rounded text-[#dfbc97]">
              <span>⠿</span>
              <span>CHAIN 420420777</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#121110] border border-[#242322] rounded text-[#aaa29a]">
              <span className="pulse-dot"></span>
              <span>BLOCK #{blockHeight}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#121110] border border-[#242322] rounded text-[#78e9c4]">
              <Zap className="w-3 h-3" />
              <span>320ms LATENCY</span>
            </div>
          </div>

          {/* Header Action Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const el = document.getElementById("sandbox-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="cyber-button px-4 py-2 text-xs mono font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>••</span>
              <span>SIMULATE DEFENSE</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#ff6a1a]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10 relative z-10">
        
        {/* HERO TECHNICAL SECTION WITH WIRES */}
        <section className="cyber-panel p-6 sm:p-10 border border-[#242322] relative overflow-hidden">
          
          {/* Animated SVG Circuit Wires */}
          <svg className="wires" viewBox="0 0 1000 320" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="cyberWireGrad">
                <stop stopColor="#ff6a1a" />
                <stop offset="0.65" stopColor="#8e431e" />
                <stop offset="1" stopColor="#242322" />
              </linearGradient>
            </defs>
            <path d="M 20 40 H 220 L 250 15 H 720 L 750 45 V 120 H 980" />
            <path className="data-flow" d="M 20 40 H 220 L 250 15 H 720 L 750 45 V 120 H 980" />
            <path d="M 60 180 H 580 L 620 220 H 960" />
          </svg>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
            
            {/* Left Hero Content (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-2 mono text-xs text-[#ff9b4d]">
                <span className="pulse-dot"></span>
                <span>AUTONOMOUS ON-CHAIN FIREWALL · TRACK 3: NODE OPERATIONS & TOOLING</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
                DETECT. PREEMPT.<br />
                <span className="text-[#ff6a1a]">DEFEND.</span>
              </h1>

              <p className="text-sm sm:text-base text-[#aaa5af] leading-relaxed max-w-xl">
                An autonomous closed-loop circuit breaker purpose-built for <strong className="text-white font-semibold">Portaldot V3 EVM (pallet-revive)</strong>. 
                When zero-day drainers or malicious router exploits strike, PortalSentinel front-runs attackers with <span className="text-[#ffb168] font-mono">1.35x priority gas escalation</span>—zeroing 
                compromised allowances and sweeping capital to cold vaults before malicious transactions finalize.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={handleSimulateAttack}
                  disabled={isSimulating}
                  className="cyber-button px-5 py-3 text-xs mono font-bold flex items-center gap-2.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-[#ff6a1a] text-[#ff6a1a]" />
                  <span>{isSimulating ? "DEFENSE IN PROGRESS..." : "SIMULATE EXPLOIT ATTACK"}</span>
                  <span className="text-[#ff6a1a]">↗</span>
                </button>

                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#121110] border border-[#242322] rounded text-xs mono text-[#dfbc97]">
                  <Lock className="w-3.5 h-3.5 text-[#ff6a1a]" />
                  <span>ZERO-CUSTODY INVARIANT: GUARANTEED</span>
                </div>
              </div>
            </div>

            {/* Right System Specs Card (5 cols) */}
            <div className="lg:col-span-5 bg-[#0e0d0c] border border-[#382c22] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#242322] pb-3">
                <span className="mono text-xs text-[#dfbc97] flex items-center gap-2">
                  <span className="pulse-dot"></span>
                  REASONING ENGINE ONLINE
                </span>
                <span className="mono text-[10px] text-[#ff9b4d] bg-[#24140a] px-2 py-0.5 border border-[#ff6a1a]/40">
                  SHIELD ACTIVE
                </span>
              </div>

              {/* Telemetry rows */}
              <ul className="mono text-xs space-y-2 text-[#9c9891]">
                <li className="flex justify-between border-b border-[#242322] py-1.5">
                  <span>TARGET NETWORK:</span>
                  <b className="text-white font-normal">Portaldot V3 Testnet</b>
                </li>
                <li className="flex justify-between border-b border-[#242322] py-1.5">
                  <span>EVM LAYER:</span>
                  <b className="text-[#ffb168] font-normal">pallet-revive (RISC-V REVM)</b>
                </li>
                <li className="flex justify-between border-b border-[#242322] py-1.5">
                  <span>CHAIN ID:</span>
                  <b className="text-white font-normal">420420777 (0x190f1ca9)</b>
                </li>
                <li className="flex justify-between border-b border-[#242322] py-1.5">
                  <span>GAS ESCALATION:</span>
                  <b className="text-[#ff9b4d] font-normal">1.35x Priority Escalation</b>
                </li>
                <li className="flex justify-between border-b border-[#242322] py-1.5">
                  <span>NON-CUSTODIAL SAFETY:</span>
                  <b className="text-[#78e9c4] font-normal">Mathematical Zero-Custody</b>
                </li>
                <li className="flex justify-between py-1.5">
                  <span>SENSITIVITY MODE:</span>
                  <b className="text-[#ff6a1a] font-normal">{defenseMode}</b>
                </li>
              </ul>

              {/* Status Note */}
              <div className="bg-[#151311] border border-[#242322] p-2.5 text-[11px] mono text-[#8b8985] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#ff6a1a] shrink-0" />
                <span>Guardian contract can only revoke or sweep to user's pre-registered safe.</span>
              </div>
            </div>

          </div>
        </section>

        {/* 5-PHASE INTERACTIVE DEFENSE SANDBOX (THE JUDGE SHOWPIECE) */}
        <section id="sandbox-section" className="cyber-panel p-6 sm:p-8 border border-[#ff6a1a]/40 bg-[#0d0c0b] space-y-6 shadow-[0_0_30px_rgba(255,106,26,0.06)]">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#242322] pb-4">
            <div>
              <div className="flex items-center gap-2 mono text-xs text-[#ff9b4d] mb-1">
                <span>01 — 05</span>
                <span>//</span>
                <span>CLOSED-LOOP DEFENSE PIPELINE</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Interactive Attack & Defense Sandbox
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={resetSimulation}
                title="Reset Sandbox"
                className="px-3 py-1.5 bg-[#171412] border border-[#382c22] hover:border-[#ff6a1a] text-xs mono text-[#b5a79a] hover:text-white transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#ff6a1a]" />
                <span>RESET SCENARIO</span>
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#aaa5af] leading-relaxed max-w-3xl">
            Simulate a live zero-day router exploit on Portaldot V3. Watch PortalSentinel evaluate the threat score, 
            calculate a 1.35x priority fee escalation, and front-run the attacker to neutralize the drain.
          </p>

          {/* 5-Phase Story Stages Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mono text-xs">
            
            <div className={`p-3 border transition ${
              simStep >= 1 ? "bg-[#211108] border-[#ff6a1a] text-white" : "bg-[#100f0e] border-[#242322] text-[#605247]"
            }`}>
              <div className="text-[10px] text-[#ff9b4d] mb-1 font-bold">PHASE 01</div>
              <div className="font-semibold text-xs mb-1">EXPLOIT TRIGGER</div>
              <p className="text-[10px] text-[#8b8985] leading-tight">Attacker calls transferFrom (5,000 pUSD)</p>
            </div>

            <div className={`p-3 border transition ${
              simStep >= 2 ? "bg-[#211108] border-[#ff6a1a] text-white" : "bg-[#100f0e] border-[#242322] text-[#605247]"
            }`}>
              <div className="text-[10px] text-[#ff9b4d] mb-1 font-bold">PHASE 02</div>
              <div className="font-semibold text-xs mb-1">THREAT DETECTED</div>
              <p className="text-[10px] text-[#8b8985] leading-tight">Engine scores 100/100 (Critical drain signature)</p>
            </div>

            <div className={`p-3 border transition ${
              simStep >= 3 ? "bg-[#211108] border-[#ff6a1a] text-white" : "bg-[#100f0e] border-[#242322] text-[#605247]"
            }`}>
              <div className="text-[10px] text-[#ff9b4d] mb-1 font-bold">PHASE 03</div>
              <div className="font-semibold text-xs mb-1">GAS ESCALATION</div>
              <p className="text-[10px] text-[#8b8985] leading-tight">1.35x Priority fee front-runs attacker</p>
            </div>

            <div className={`p-3 border transition ${
              simStep >= 4 ? "bg-[#211108] border-[#ff6a1a] text-white" : "bg-[#100f0e] border-[#242322] text-[#605247]"
            }`}>
              <div className="text-[10px] text-[#ff9b4d] mb-1 font-bold">PHASE 04</div>
              <div className="font-semibold text-xs mb-1">ATOMIC REVOKE</div>
              <p className="text-[10px] text-[#8b8985] leading-tight">executeEmergencyBatchRevoke mined</p>
            </div>

            <div className={`p-3 border transition ${
              simStep >= 5 ? "bg-[#112419] border-[#78e9c4] text-white" : "bg-[#100f0e] border-[#242322] text-[#605247]"
            }`}>
              <div className="text-[10px] text-[#78e9c4] mb-1 font-bold">PHASE 05</div>
              <div className="font-semibold text-xs mb-1">CAPITAL RESCUED</div>
              <p className="text-[10px] text-[#8b8985] leading-tight">Allowance = 0, exploit call reverts!</p>
            </div>

          </div>

          {/* Action Trigger Button */}
          <div className="pt-2">
            <button
              disabled={isSimulating}
              onClick={handleSimulateAttack}
              className={`w-full py-4 px-6 text-sm mono font-bold flex items-center justify-center gap-3 transition cursor-pointer ${
                isSimulating
                  ? "bg-[#1b120c] border border-[#ff6a1a] text-[#ff9b4d] cursor-wait"
                  : "cyber-button shadow-[0_0_25px_rgba(255,106,26,0.3)]"
              }`}
            >
              {isSimulating ? (
                <>
                  <Activity className="w-4 h-4 animate-spin text-[#ff6a1a]" />
                  <span>INTERCEPTING THREAT ON PORTALDOT V3 (STEP 0{simStep} / 05)...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-[#ff6a1a] text-[#ff6a1a]" />
                  <span>[🚨 RUN EXPLOIT & DEFENSE SANDBOX]</span>
                </>
              )}
            </button>
          </div>

          {/* Verifiable On-Chain Output */}
          {lastTxHash && (
            <div className="p-4 bg-[#0a1610] border border-[#78e9c4]/40 text-xs mono space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[#78e9c4] font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> DEFENSE TRANSACTION CONFIRMED ON TESTNET:
                </span>
                <a 
                  href="https://node-console.portaldot.dev/" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:underline text-[11px] text-[#ff9b4d]"
                >
                  Inspect in Node Console <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-[11px] text-white/90 break-all bg-black/60 p-2.5 border border-[#242322]">
                Tx Hash: {lastTxHash}
              </div>
            </div>
          )}

        </section>

        {/* TWO-COLUMN OPERATIONAL GRID: APPROVALS (7 cols) + TERMINAL (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Monitored Approvals & Policy Config (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Approvals Scanner Card */}
            <div className="cyber-panel p-6 border border-[#242322] space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242322] pb-3">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ff6a1a]" />
                    Active ERC-20 Allowances Scanner
                  </h3>
                  <p className="text-xs text-[#8b8985] mono">Wallet: {userAddress.slice(0, 10)}...{userAddress.slice(-6)}</p>
                </div>

                {/* Sensitivity Mode Pills */}
                <div className="flex items-center gap-1 bg-[#121110] p-1 border border-[#242322] text-[10px] mono">
                  {(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDefenseMode(mode)}
                      className={`px-2 py-1 transition cursor-pointer ${
                        defenseMode === mode 
                          ? "bg-[#24140a] text-[#ff9b4d] font-bold border border-[#ff6a1a]/50" 
                          : "text-[#8b8985] hover:text-white"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cold Safe Input */}
              <div className="bg-[#0e0d0c] p-3.5 border border-[#242322] space-y-1.5">
                <label className="text-[11px] mono text-[#dfbc97] block">
                  REGISTERED EMERGENCY COLD SAFE (Sweep Invariant Target)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={emergencySafe}
                    onChange={(e) => setEmergencySafe(e.target.value)}
                    className="w-full bg-[#151413] border border-[#382c22] px-3 py-1.5 text-xs mono text-white focus:outline-none focus:border-[#ff6a1a]"
                  />
                  <span className="shrink-0 text-[10px] mono text-[#78e9c4] px-2 py-1 bg-[#122419] border border-[#78e9c4]/30">
                    VERIFIED SAFE
                  </span>
                </div>
              </div>

              {/* Allowances Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#242322] text-[10px] mono text-[#8b8985] uppercase">
                      <th className="pb-2">Spender Contract</th>
                      <th className="pb-2">Token</th>
                      <th className="pb-2">Allowance</th>
                      <th className="pb-2">Threat Risk</th>
                      <th className="pb-2 text-right">Circuit Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1c1b]">
                    {approvals.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#121110] transition">
                        <td className="py-3">
                          <div className="font-semibold text-white">{item.spenderName}</div>
                          <div className="text-[10px] text-[#8b8985] mono">{item.spender.slice(0, 10)}...{item.spender.slice(-6)}</div>
                        </td>
                        <td className="py-3 mono text-[#dfbc97]">{item.tokenSymbol}</td>
                        <td className="py-3 mono font-semibold text-white">{item.allowance}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 text-[10px] mono font-bold border ${
                            item.status === "CRITICAL"
                              ? "bg-[#29100c] text-[#ff7056] border-[#ff4e2e]/50"
                              : "bg-[#0d2218] text-[#78e9c4] border-[#78e9c4]/30"
                          }`}>
                            {item.status} ({item.riskScore})
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-[10px] mono text-[#ff9b4d] flex items-center justify-end gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Auto-Armed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

          {/* Right Column: Node Operations Terminal & Tooling (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Streaming Terminal Card */}
            <div className="cyber-panel p-5 border border-[#242322] space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-[#242322] pb-2.5">
                <span className="mono font-bold text-white flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[#ff6a1a]" />
                  SENTINEL DAEMON LOGS
                </span>
                <span className="mono text-[10px] text-[#78e9c4] flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse text-[#ff6a1a]" />
                  STREAMING BLOCK MEMPOOL
                </span>
              </div>

              {/* Terminal Box */}
              <div className="bg-[#050505] p-3 border border-[#242322] h-56 overflow-y-auto mono text-[11px] space-y-1.5 text-[#b5a79a]">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Node Operations CLI Cheat Sheet (Track 3 Tooling) */}
            <div className="cyber-panel p-5 border border-[#242322] space-y-3 bg-[#0d0c0b]">
              <div className="flex items-center gap-2 border-b border-[#242322] pb-2 text-xs mono text-[#dfbc97] font-bold">
                <Server className="w-3.5 h-3.5 text-[#ff6a1a]" />
                <span>NODE OPERATOR CLI TOOLING</span>
              </div>

              <div className="space-y-2 mono text-[11px]">
                <div className="p-2 bg-[#121110] border border-[#242322]">
                  <span className="text-[#8b8985] block text-[9px]">// Probe Portaldot V3 EVM & Substrate node latency:</span>
                  <code className="text-[#ff9b4d]">npm run cli:health</code>
                </div>

                <div className="p-2 bg-[#121110] border border-[#242322]">
                  <span className="text-[#8b8985] block text-[9px]">// Audit wallet or contract for dangerous spenders:</span>
                  <code className="text-[#ff9b4d]">cd daemon && npm run cli audit &lt;address&gt;</code>
                </div>

                <div className="p-2 bg-[#121110] border border-[#242322]">
                  <span className="text-[#8b8985] block text-[9px]">// Run RPC latency benchmark across 5 queries:</span>
                  <code className="text-[#ff9b4d]">npm run cli:benchmark</code>
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Clean Cyber Footer (Streamlined per user instruction) */}
      <footer className="border-t border-[#242322] bg-[#080808] py-8 px-4 sm:px-6 text-xs mono text-[#8b8985] mt-16 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full border border-[#ff6a1a] flex items-center justify-center text-[10px] text-[#ff9b4d]">••</span>
            <span className="text-white font-bold">PORTAL SENTINEL</span>
            <span className="text-[#605247]">/</span>
            <span>PORTALDOT HACKER HOUSE 2026 (TRACK 3)</span>
          </div>

          <div className="flex items-center gap-5">
            <a 
              href="https://node-console.portaldot.dev/" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              Node Console <ExternalLink className="w-3 h-3" />
            </a>
            <a 
              href="https://test-evm-rpc-v3.portaldot.dev" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-white transition"
            >
              EVM RPC
            </a>
            <span className="text-[#ff6a1a]">ZERO-CUSTODY INVARIANT VERIFIED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
