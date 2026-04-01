import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, UserCheck, AlertOctagon } from 'lucide-react';

export default function DemoPanel() {
    const [soldiers, setSoldiers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [log, setLog] = useState('');

    // Fetch the mock directory
    useEffect(() => {
        fetchSoldiers();
    }, []);

    const fetchSoldiers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/soldiers');
            // Mix list and take a few
            setSoldiers(res.data.sort(() => 0.5 - Math.random()).slice(0, 8));
        } catch (err) {
            console.error(err);
        }
    };

    const simulateAccess = async (id) => {
        setLoading(true);
        setLog(`[${new Date().toLocaleTimeString()}] Target: ${id}...`);
        try {
            // Axios request masquerades as standard fetch
            await axios.get(`http://localhost:5000/api/soldier/${id}`, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (curl/8.4) Automated Exploit Tool v2'
                }
            });
            setLog(prev => prev + `\n[${new Date().toLocaleTimeString()}] Access granted. Extracting data... SUCCESS.`);
        } catch (err) {
            setLog(prev => prev + `\n[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`);
        }
        setLoading(false);
    };

    return (
        <div className="bg-dark p-4 rounded-lg border border-slate-800 shadow flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold tracking-widest text-slate-300 flex items-center gap-2">
                    <Play className="w-4 h-4 text-primary" />
                    INFILTRATION SIMULATOR
                </h2>
                <button onClick={fetchSoldiers} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded text-slate-300 transition">
                    Refresh Database
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Directory simulation */}
                <div className="border border-slate-700 rounded bg-slate-900 overflow-y-auto max-h-[250px] p-2">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="text-xs uppercase bg-slate-800 text-slate-300">
                            <tr>
                                <th className="px-2 py-1">ID</th>
                                <th className="px-2 py-1">Personnel</th>
                                <th className="px-2 py-1 flex justify-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {soldiers.map((s, idx) => (
                                <tr key={`${s.id}-${idx}`} className="border-b border-slate-800 hover:bg-slate-800/50 transition">
                                    <td className="px-2 py-2 font-mono text-xs text-slate-500">{s.id}</td>
                                    <td className="px-2 py-2 text-slate-300 text-xs">{s.rank_title} {s.name}</td>
                                    <td className="px-2 py-2 flex justify-end">
                                        <button
                                            onClick={() => simulateAccess(s.id)}
                                            disabled={loading}
                                            className="bg-danger/10 hover:bg-danger/30 text-danger border border-danger/50 px-2 py-1 rounded flex items-center gap-1 transition disabled:opacity-50 text-[10px] font-bold tracking-wider"
                                            title="Simulate Data Extraction"
                                        >
                                            <AlertOctagon className="w-3 h-3" />
                                            EXTRACT
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Hacker Terminal Logs */}
                <div className="border border-slate-700 rounded bg-black p-3 font-mono text-xs text-green-500 overflow-y-auto max-h-[250px] shadow-inner">
                    <div className="text-slate-500 mb-2">// ADVERSARY TERMINAL (Red Team)</div>
                    <div className="text-slate-500 mb-2">// Payload ready. Select target to infiltrate.</div>
                    <pre className="whitespace-pre-wrap">{log}</pre>
                </div>
            </div>
        </div>
    );
}
