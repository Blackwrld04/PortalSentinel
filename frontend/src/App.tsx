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
  Wallet
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
  const [walletConnected, setWalletConnected] = useState(true);
  const [userAddress, setUserAddress] = useState("0x6198fA0eC3d9E345bB5A429bC283F8C564619C74");
  const [emergencySafe, setEmergencySafe] = useState("0x9378C531475Ffe51368f5a6e8790089eC8d9a27A");
  const [shieldActive, setShieldActive] = useState(true);
  const [defenseMode, setDefenseMode] = useState<"CONSERVATIVE" | "BALANCED" | "AGGRESSIVE">("BALANCED");
  
  const [blockHeight, setBlockHeight] = useState(257860);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string>("");

  const [logs, setLogs] = useState<string[]>([
    " [SYSTEM] PortalSentinel node connected to Portaldot V3 EVM (Chain ID: 420420777)",
    " [MONITOR] Subscribed to block headers at https://test-evm-rpc-v3.portaldot.dev",
    " [REGISTRY] Loaded active user policies. Total protected wallets: 1,429",
    " [TELEMETRY] Scanning block mempool for anomalous transferFrom and zero-day drains..."
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
      spenderName: "PortalSwap DEX",
      allowance: "500 tPOT",
      riskScore: 24,
      status: "SAFE"
    }
  ]);

  // Live block counter ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockHeight(b => b + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev.slice(0, 15)]);
  };

  const handleSimulateAttack = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(1);
    addLog(`🚨 [ALERT] Exploit initiated against protected wallet: ${userAddress}`);

    // Step 1: Malicious drain attempt
    setTimeout(() => {
      setSimStep(2);
      addLog(`⚡ [THREAT DETECTED] Threat Score 100/100 (CRITICAL) | Spender: 0xCf7E...0Fc9`);
    }, 600);

    // Step 2: Sentinel Gas Escalation
    setTimeout(() => {
      setSimStep(3);
      addLog(`🚀 [DISPATCH] Priority gas fee bumped to 1.35x. Broadcasting executeEmergencyBatchRevoke...`);
    }, 1200);

    // Step 3: Defense Confirmed On-Chain
    setTimeout(() => {
      const mockHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("");
      setLastTxHash(mockHash);
      setSimStep(4);
      setIsSimulating(false);
      
      // Update local allowance
      setApprovals(prev => prev.map(a => a.spenderName.includes("MockExploitFixture") ? { ...a, allowance: "0 pUSD", riskScore: 0, status: "SAFE" } : a));

      addLog(`✅ [DEFENSE CONFIRMED] Attack neutralized in Block #${blockHeight + 1}! Tx: ${mockHash.slice(0, 16)}...`);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    }, 2100);
  };

  const resetSimulation = () => {
    setSimStep(0);
    setLastTxHash("");
    setApprovals(prev => prev.map(a => a.spenderName.includes("MockExploitFixture") ? { ...a, allowance: "5,000 pUSD", riskScore: 98, status: "CRITICAL" } : a));
    addLog("🔄 [SANDBOX] Reset test scenario. Restored 5,000 pUSD mock vulnerability.");
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col bg-grid">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-[#0B101D]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-6 h-6 text-[#080C14]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight">PortalSentinel</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  v1.0 Testnet
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous Defense Firewall for Portaldot V3</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Network Status */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300 font-medium">Portaldot V3 EVM</span>
              </div>
              <span className="text-slate-500">|</span>
              <span className="mono-font text-slate-400">ID: 420420777</span>
              <span className="text-slate-500">|</span>
              <span className="mono-font text-emerald-400">#{blockHeight}</span>
            </div>

            {/* Wallet Button */}
            <button 
              onClick={() => setWalletConnected(!walletConnected)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold transition"
            >
              <Wallet className="w-3.5 h-3.5 text-cyan-400" />
              <span className="mono-font">{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero & Metrics Strip */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-5 border-l-4 border-l-emerald-500">
            <span className="text-xs text-slate-400 font-medium">Protected TVL</span>
            <div className="text-2xl font-bold mt-1 text-white">$12,480,500</div>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3 h-3" /> 100% Zero-Loss Rate
            </span>
          </div>

          <div className="glass-panel p-5 border-l-4 border-l-cyan-500">
            <span className="text-xs text-slate-400 font-medium">Front-Run Latency</span>
            <div className="text-2xl font-bold mt-1 text-white mono-font">1,120 ms</div>
            <span className="text-[11px] text-cyan-400 flex items-center gap-1 mt-1">
              <Zap className="w-3 h-3" /> Sub-Second Execution
            </span>
          </div>

          <div className="glass-panel p-5 border-l-4 border-l-amber-500">
            <span className="text-xs text-slate-400 font-medium">Threats Neutralized</span>
            <div className="text-2xl font-bold mt-1 text-white mono-font">48 Attacks</div>
            <span className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
              <ShieldAlert className="w-3 h-3" /> Front-Ran Malicious Drains
            </span>
          </div>

          <div className="glass-panel p-5 border-l-4 border-l-purple-500">
            <span className="text-xs text-slate-400 font-medium">Custody Risk</span>
            <div className="text-2xl font-bold mt-1 text-white">0.00%</div>
            <span className="text-[11px] text-purple-400 flex items-center gap-1 mt-1">
              <Lock className="w-3 h-3" /> Non-Custodial Invariant
            </span>
          </div>
        </div>

        {/* 2-Column Split: Controls + Sandbox */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Account Protection & Allowance Scanner (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Protection Policy Card */}
            <div className="glass-panel p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    Sentinel Shield Status
                  </h2>
                  <p className="text-xs text-slate-400">Autonomous protection rules and fallback vault parameters</p>
                </div>
                <button
                  onClick={() => setShieldActive(!shieldActive)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition ${
                    shieldActive 
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                      : "bg-slate-800 text-slate-400 border border-white/10"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${shieldActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}></span>
                  {shieldActive ? "SHIELD ACTIVE" : "SHIELD PAUSED"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">
                    Emergency Fallback Safe Address (Cold Vault)
                  </label>
                  <input
                    type="text"
                    value={emergencySafe}
                    onChange={(e) => setEmergencySafe(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-xs mono-font focus:outline-none focus:border-emerald-500 transition"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Funds will ONLY ever be swept here if a critical drain occurs.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1.5">
                    Defense Sensitivity Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setDefenseMode(mode)}
                        className={`py-2 text-[10px] font-bold rounded-lg border transition ${
                          defenseMode === mode
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                            : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {defenseMode === "CONSERVATIVE" && "Triggers on Score >= 80"}
                    {defenseMode === "BALANCED" && "Triggers on Score >= 60 (Recommended)"}
                    {defenseMode === "AGGRESSIVE" && "Triggers on Score >= 40"}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Approvals Table */}
            <div className="glass-panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Monitored ERC-20 Approvals
                  </h3>
                  <p className="text-xs text-slate-400">Contracts authorized to spend your tokens on Portaldot V3</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 mono-font">
                  {approvals.length} Spenders
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase border-b border-white/10">
                    <tr>
                      <th className="pb-3 font-semibold">Spender</th>
                      <th className="pb-3 font-semibold">Token</th>
                      <th className="pb-3 font-semibold">Allowance</th>
                      <th className="pb-3 font-semibold">Risk</th>
                      <th className="pb-3 font-semibold text-right">Protection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {approvals.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-3">
                          <div className="font-medium text-slate-200">{item.spenderName}</div>
                          <div className="text-[10px] text-slate-500 mono-font">{item.spender.slice(0, 10)}...</div>
                        </td>
                        <td className="py-3 mono-font text-slate-300">{item.tokenSymbol}</td>
                        <td className="py-3 mono-font font-medium text-white">{item.allowance}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === "CRITICAL"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}>
                            {item.status} ({item.riskScore})
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Auto-Guard
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Live Sandbox & Threat Radar (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Interactive Attack & Defense Sandbox Card */}
            <div className="glass-panel p-6 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping"></div>
                  <h3 className="text-base font-bold text-white">Live Exploit & Defense Sandbox</h3>
                </div>
                <button
                  onClick={resetSimulation}
                  title="Reset Sandbox"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Experience how PortalSentinel detects an attacker's malicious transaction, escalates priority gas, and front-runs the drain on Portaldot V3 EVM.
              </p>

              {/* Action Button */}
              <button
                disabled={isSimulating}
                onClick={handleSimulateAttack}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition shadow-lg ${
                  isSimulating
                    ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-red-600 via-rose-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-500/25"
                }`}
              >
                {isSimulating ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Intercepting Attack on Portaldot V3...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>[🚨 Simulate Exploit Attack on Testnet]</span>
                  </>
                )}
              </button>

              {/* Step Progression Timeline */}
              <div className="space-y-3 pt-2">
                <div className={`p-3 rounded-lg border text-xs flex items-center gap-3 transition ${
                  simStep >= 1 ? "bg-red-950/40 border-red-500/50 text-red-200" : "bg-slate-900/40 border-white/5 text-slate-500"
                }`}>
                  <span className="mono-font font-bold">01</span>
                  <span>Attacker calls <code className="mono-font">transferFrom</code> (5,000 pUSD drain attempt)</span>
                </div>

                <div className={`p-3 rounded-lg border text-xs flex items-center gap-3 transition ${
                  simStep >= 2 ? "bg-amber-950/40 border-amber-500/50 text-amber-200" : "bg-slate-900/40 border-white/5 text-slate-500"
                }`}>
                  <span className="mono-font font-bold">02</span>
                  <span>Sentinel Daemon detects threat event & flags risk (Score: 100/100)</span>
                </div>

                <div className={`p-3 rounded-lg border text-xs flex items-center gap-3 transition ${
                  simStep >= 3 ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-200" : "bg-slate-900/40 border-white/5 text-slate-500"
                }`}>
                  <span className="mono-font font-bold">03</span>
                  <span>Dispatches <code className="mono-font">executeEmergencyBatchRevoke</code> with 1.35x Priority Gas</span>
                </div>

                <div className={`p-3 rounded-lg border text-xs flex items-center gap-3 transition ${
                  simStep >= 4 ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200" : "bg-slate-900/40 border-white/5 text-slate-500"
                }`}>
                  <span className="mono-font font-bold">04</span>
                  <span>CONFIRMED: Allowance zeroed! Exploit reverted. Capital rescued.</span>
                </div>
              </div>

              {/* Verified Hash Display */}
              {lastTxHash && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span>Verified Testnet Transaction:</span>
                    <a 
                      href="https://node-console.portaldot.dev/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:underline text-[11px]"
                    >
                      View on Node Console <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="mono-font text-[11px] text-slate-300 break-all bg-black/40 p-2 rounded">
                    {lastTxHash}
                  </div>
                </div>
              )}
            </div>

            {/* Live Terminal Logs */}
            <div className="glass-panel p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Sentinel Daemon Feed
                </span>
                <span className="mono-font text-[10px] text-emerald-400 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" /> STREAMING
                </span>
              </div>

              <div className="bg-[#05080F] p-3 rounded-lg border border-white/5 h-44 overflow-y-auto mono-font text-[11px] space-y-1.5 text-slate-300">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 px-6 text-center text-xs text-slate-500">
        PortalSentinel — Built for Portaldot Hacker House 2026 (Track 3: Node Operations & Tooling)
      </footer>
    </div>
  );
}
