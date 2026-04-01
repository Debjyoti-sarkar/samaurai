import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, AlertOctagon, Terminal } from 'lucide-react';

export default function DemoPanel({ onSimulate }) {
    const [soldiers, setSoldiers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState('');

    useEffect(() => {
        fetchSoldiers();
    }, []);

    const fetchSoldiers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/soldiers');
            setSoldiers(res.data.sort(() => 0.5 - Math.random()).slice(0, 5));
        } catch (err) {
            console.error(err);
        }
    };

    const simulateAccess = async (id, isAttackerRole) => {
        setLoading(true);
        setLog(`[${new Date().toLocaleTimeString()}] Role: ${isAttackerRole ? 'UNAUTHORIZED' : 'INSIDER'} -> Target: ${id}...`);
        try {
            // Axios request masquerades as standard fetch
            const res = await axios.get(`http://localhost:5000/api/soldier/${id}`, {
                headers: {
                    'user-agent': isAttackerRole ? 'Mozilla/5.0 (curl/8.4) Automated Exploit Tool v2' : 'Mozilla/5.0 (Windows NT) Chrome',
                    'x-agency-role': isAttackerRole ? 'UNKNOWN' : 'CERT-In',
                    'x-user-id': 'USER-' + Math.floor(Math.random() * 1000)
                }
            });

            const isTrapped = !!res.data.classified_data;
            const quantumData = !!res.data.quantum_protected_salary;

            setLog(prev => prev + `\n[${new Date().toLocaleTimeString()}] Access granted. Extraction SUCCESS.`);

            if (isTrapped) {
                setLog(prev => prev + `\n[${new Date().toLocaleTimeString()}] !! FOUND CLASSIFIED BUNDLE !! Downloading...`);
                setLog(prev => prev + `\n=> Found Document link: ${res.data.classified_data.downloadable_dossier.slice(1, 15)}...`);
                // Simulate hitting the canary trap
                setTimeout(async () => {
                    setLog(prev => prev + `\n[${new Date().toLocaleTimeString()}] Opening intercepted dossier...`);
                    await axios.get(`http://localhost:5000${res.data.classified_data.downloadable_dossier}`);
                }, 1000);
            } else if (quantumData) {
                setLog(prev => prev + `\n[${new Date().toLocaleTimeString()}] Target salary blocked by PQE-LATTICE-SIM cryptography. Extract failed.`);
            }

        } catch (err) {
            setLog(prev => prev + `\n[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`);
        }
        setLoading(false);
    };

    return (
        <div className="bg-dark p-4 rounded-lg border border-slate-800 shadow flex flex-col gap-4 w-full h-full">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold tracking-widest text-slate-300 flex items-center gap-2">
                    <Play className="w-4 h-4 text-primary" />
                    V2 ATTACK VECTORS & INSIDER THREATS
                </h2>
                <button onClick={fetchSoldiers} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300 transition uppercase tracking-wider">
                    Sync Dir
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Directory simulation */}
                <div className="border border-slate-700 rounded bg-slate-900 overflow-y-auto max-h-[250px] p-2 flex flex-col gap-1">
                    {soldiers.map((s, idx) => (
                        <div key={`${s.id}-${idx}`} className="flex justify-between items-center p-2 border-b border-slate-800 bg-black/20 hover:bg-slate-800/50 transition rounded">
                            <div className="flex flex-col">
                                <span className="font-mono text-[10px] text-slate-500">{s.id}</span>
                                <span className="text-slate-300 text-xs">{s.name} ({s.rank_title})</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => simulateAccess(s.id, false)}
                                    disabled={loading}
                                    className="bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 px-2 py-1 rounded transition disabled:opacity-50 text-[10px] font-bold tracking-wider"
                                    title="Simulate Insider Threat (Spam to flag)"
                                >
                                    INTERNAL
                                </button>
                                <button
                                    onClick={() => simulateAccess(s.id, true)}
                                    disabled={loading}
                                    className="bg-danger/10 hover:bg-danger/30 text-danger border border-danger/50 px-2 py-1 rounded transition disabled:opacity-50 text-[10px] font-bold tracking-wider flex items-center gap-1"
                                    title="Simulate Enemy Extraction"
                                >
                                    <AlertOctagon className="w-3 h-3" /> ENEMY
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Hacker Terminal Logs */}
                <div className="border border-slate-700 rounded bg-[#0a0f0d] p-3 font-mono text-[10px] text-green-500 overflow-y-auto max-h-[250px] shadow-inner flex flex-col gap-1">
                    <div className="text-slate-500 mb-2 flex items-center gap-2"><Terminal className="w-4 h-4" /> // RED TEAM OFFENSIVE SUITE</div>
                    <pre className="whitespace-pre-wrap break-words">{log}</pre>
                </div>
            </div>
        </div>
    );
}
