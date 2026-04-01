import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import DemoPanel from './components/DemoPanel';
import AlertLogs from './components/AlertLogs';
import BehavioralBiometrics from './components/BehavioralBiometrics';
import { Activity, ShieldAlert, WifiHigh, GlobeLock, UserCheck } from 'lucide-react';

function App() {
  const [alerts, setAlerts] = useState([]);
  const [aiIntel, setAiIntel] = useState({});
  const [wsStatus, setWsStatus] = useState('connecting');
  const [agencyRole, setAgencyRole] = useState('ARMY_COMMAND'); // Mock Federated login

  const ws = useRef(null);

  useEffect(() => {
    const connectWs = () => {
      ws.current = new WebSocket('ws://localhost:5000');

      ws.current.onopen = () => setWsStatus('connected');
      ws.current.onclose = () => {
        setWsStatus('disconnected');
        setTimeout(connectWs, 3000);
      };

      ws.current.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        // Handle standard intrusion and canary alerts
        if (message.type === 'INTRUSION_ALERT' || message.type === 'CANARY_TRIPPED') {
          try {
            const res = await fetch('http://localhost:5000/api/decrypt-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encryptedData: message.data })
            });
            const data = await res.json();
            if (data.success) {
              setAlerts(prev => [data.payload, ...prev].slice(0, 100));
            }
          } catch (err) {
            console.error('Decryption failed', err);
          }
        }

        // Handle AI Python profiling updates for the Heatmap
        if (message.type === 'AI_INTEL_UPDATE') {
          const { ip, profile, geo } = message.data;
          setAiIntel(prev => ({ ...prev, [ip]: { profile, geo } }));
        }
      };
    };

    connectWs();
    return () => ws.current?.close();
  }, []);

  const handleBiometricAnomaly = (msg) => {
    console.warn(msg);
    // In a real app we'd dispatch this to the backend to lock the terminal
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex flex-col relative">
      <BehavioralBiometrics onAnomalyDetected={handleBiometricAnomaly} />

      {/* Top Navigation - V2 Federated Interface */}
      <header className="bg-dark/80 backdrop-blur border-b border-slate-800 p-3 flex justify-between items-center shadow-md z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <GlobeLock className="text-cyan-500 w-8 h-8" />
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-widest text-slate-100 uppercase">KAVACH <span className="text-cyan-500">SENTINEL</span> <span className="text-xs bg-slate-800 px-1 rounded text-slate-400">V2</span></h1>
            <span className="text-[10px] text-slate-500 font-mono tracking-widest">ADVANCED CYBER INTELLIGENCE PLATFORM</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Federated Mock Toggler */}
          <div className="flex items-center gap-2 border border-slate-800 rounded bg-black p-1">
            <UserCheck className="w-4 h-4 text-slate-500" />
            <select
              value={agencyRole}
              onChange={e => setAgencyRole(e.target.value)}
              className="bg-transparent text-xs text-slate-300 outline-none font-bold tracking-wider"
            >
              <option value="ARMY_COMMAND">Army Command</option>
              <option value="CERT-In">CERT-In (Gov)</option>
              <option value="INTEL_AGENCY">Intelligence Bureau</option>
            </select>
          </div>

          <div className="flex justify-center flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none">Global Defense Grid</span>
            <span className="text-xs text-cyan-400 font-black tracking-widest flex items-center gap-2">
              ACTIVE
            </span>
          </div>
          <div className={`px-3 py-1 rounded-sm text-[10px] font-black tracking-widest border flex items-center gap-2 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${wsStatus === 'connected' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-500' : 'bg-red-500/10 border-red-500/50 text-red-500'}`}>
            <WifiHigh className="w-3 h-3" />
            {wsStatus === 'connected' ? 'QUANTUM LINK SECURE' : 'LINK DEGRADED'}
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4 overflow-hidden relative z-0">
        {/* Left pane: Main Dashboard / Map */}
        <section className="flex-1 flex flex-col gap-4 min-w-0">
          <Dashboard alerts={alerts} aiIntel={aiIntel} />
          <div className="h-64 shrink-0">
            <DemoPanel />
          </div>
        </section>

        {/* Right pane: Alert Logs */}
        <aside className="w-full md:w-[450px] flex flex-col bg-dark/90 border border-slate-800 rounded-lg shadow-2xl overflow-hidden shrink-0">
          <div className="p-3 border-b border-slate-800 bg-black/40 flex justify-between items-center backdrop-blur">
            <h2 className="text-sm font-black tracking-widest text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-500" />
              THREAT INTEL FEED
            </h2>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 text-[10px] font-black tracking-widest rounded shadow">{Object.keys(aiIntel).length} PROFILES</span>
              <span className="px-2 py-0.5 bg-danger/20 text-danger border border-danger/30 text-[10px] font-black tracking-widest rounded shadow">{alerts.length} STRIKES</span>
            </div>
          </div>
          <AlertLogs alerts={alerts} aiIntel={aiIntel} />
        </aside>
      </main>
    </div>
  );
}

export default App;
