import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import DemoPanel from './components/DemoPanel';
import AlertLogs from './components/AlertLogs';
import { Activity, ShieldAlert, WifiHigh } from 'lucide-react';

function App() {
  const [alerts, setAlerts] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const ws = useRef(null);

  useEffect(() => {
    // Connect to WebSocket
    const connectWs = () => {
      ws.current = new WebSocket('ws://localhost:5000');

      ws.current.onopen = () => setWsStatus('connected');
      ws.current.onclose = () => {
        setWsStatus('disconnected');
        setTimeout(connectWs, 3000); // Reconnect
      };

      ws.current.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'INTRUSION_ALERT') {
          // Send encrypted payload to backend to decrypt for dashboard display
          // In a real system, dashboard would hold the key and decrypt locally, but this is a POC.
          try {
            const res = await fetch('http://localhost:5000/api/decrypt-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encryptedData: message.data })
            });
            const data = await res.json();
            if (data.success) {
              setAlerts(prev => [data.payload, ...prev].slice(0, 100)); // Keep last 100 alerts
            }
          } catch (err) {
            console.error('Decryption failed', err);
          }
        }
      };
    };

    connectWs();
    return () => ws.current?.close();
  }, []);

  return (
    <div className="min-h-screen bg-darker text-slate-200 font-sans flex flex-col">
      {/* Top Navigation */}
      <header className="bg-dark border-b border-slate-800 p-4 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-3">
          <ShieldAlert className="text-danger w-8 h-8" />
          <h1 className="text-xl font-bold tracking-widest text-slate-100">KAVACH <span className="text-danger">SENTINEL</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex justify-center flex-col items-end">
            <span className="text-xs text-slate-400 uppercase tracking-widest">Network Status</span>
            <span className="text-sm text-primary font-mono tracking-wider items-center flex gap-2">
              ACTIVE
            </span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${wsStatus === 'connected' ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-red-500/20 border-red-500/50 text-red-500'}`}>
            <WifiHigh className="w-3 h-3" />
            {wsStatus === 'connected' ? 'SECURE C2 LINK' : 'LINK OFFLINE'}
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
        {/* Left pane: Main Dashboard / Map */}
        <section className="flex-1 flex flex-col gap-4">
          <Dashboard alerts={alerts} />
          <DemoPanel />
        </section>

        {/* Right pane: Alert Logs */}
        <aside className="w-full md:w-[450px] flex flex-col bg-dark border border-slate-800 rounded-lg shadow-lg overflow-hidden shrink-0">
          <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h2 className="text-sm font-bold tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              LIVE THREAT INTEL
            </h2>
            <span className="px-2 py-0.5 bg-danger/20 text-danger text-xs font-mono rounded">{alerts.length} EVENTS</span>
          </div>
          <AlertLogs alerts={alerts} />
        </aside>
      </main>
    </div>
  );
}

export default App;
