import React from 'react';
import { Target, Activity, ShieldAlert, Cpu } from 'lucide-react';

export default function Dashboard({ alerts, aiIntel }) {
    const activeThreats = alerts.filter(a => a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH').length;

    return (
        <div className="flex-1 flex flex-col gap-4">
            {/* V2 Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Target />} title="HONEYPOTS DEPLOYED" value="10" color="text-primary" />
                <StatCard icon={<ShieldAlert />} title="INTRUSION EVENTS" value={alerts.length} color="text-danger" />
                <StatCard icon={<Activity />} title="COUNTER-INTEL GATHERED" value={Object.keys(aiIntel).length} color="text-yellow-500" />
                <StatCard icon={<Cpu />} title="QUANTUM-RESIST ENGINE" value="ONLINE" color="text-cyan-400" />
            </div>

            {/* Map / Visualization Area (Geographic Heatmap India) */}
            <div className="flex-1 bg-dark border border-slate-800 rounded-lg relative overflow-hidden flex flex-col shadow-inner min-h-[300px]">
                <div className="absolute inset-0 map-grid opacity-30 pointer-events-none"></div>
                <div className="p-3 border-b border-slate-800 relative z-10 flex justify-between items-center bg-dark/80 backdrop-blur-sm">
                    <h2 className="text-sm font-bold tracking-widest text-slate-400">GEOGRAPHIC HEATMAP CLUSTERING (INDIA GEO-ZONE)</h2>
                    <span className="text-xs text-slate-500 font-mono">NODE: FEDERATED-CORE</span>
                </div>

                {/* Mock Map View with India Shape */}
                <div className="flex-1 relative p-4 flex items-center justify-center overflow-hidden bg-[#020617]">
                    {/* Rough India SVG Overlay Simulation */}
                    <div className="absolute w-[300px] h-[350px] opacity-10">
                        <svg viewBox="0 0 100 100" className="w-full h-full text-blue-500 fill-current">
                            <path d="M 40,0 L 60,10 L 70,30 L 90,40 L 90,60 L 70,80 L 50,100 L 40,80 L 20,60 L 10,40 L 20,20 Z" />
                        </svg>
                    </div>

                    {/* Radar circle effect */}
                    <div className="absolute w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full border border-primary/20 flex items-center justify-center animate-pulse">
                        <div className="absolute w-[200px] h-[200px] md:w-[250px] md:h-[250px] rounded-full border border-primary/20"></div>
                        <div className="absolute w-[100px] h-[100px] md:w-[150px] md:h-[150px] rounded-full border border-primary/30"></div>
                    </div>

                    {/* Plot AI Intel Geo-locations */}
                    {Object.entries(aiIntel).map(([ip, intel]) => {
                        // Derive somewhat deterministic plot from geo region
                        let top = 50, left = 50;
                        if (intel.geo?.region === 'Delhi NCR') { top = 20; left = 45; }
                        if (intel.geo?.region === 'Mumbai') { top = 60; left = 25; }
                        if (intel.geo?.region === 'Bangalore') { top = 80; left = 45; }
                        if (intel.geo?.region === 'Kolkata') { top = 55; left = 75; }
                        if (intel.geo?.region === 'Chennai') { top = 85; left = 55; }

                        // Add jitter
                        top += Math.random() * 5 - 2.5; left += Math.random() * 5 - 2.5;

                        return (
                            <div key={ip} className="absolute w-4 h-4 bg-danger rounded-full shadow-[0_0_15px_#ef4444] animate-bounce"
                                style={{ top: `${top}%`, left: `${left}%` }} title={`Target: ${ip} [${intel.geo?.region}]`}>
                                <div className="absolute w-12 h-12 rounded-full border-2 border-danger/60 -top-4 -left-4 animate-ping"></div>
                                <div className="absolute -top-6 -left-10 bg-black/80 text-[8px] text-white p-1 rounded font-mono whitespace-nowrap">
                                    {intel.geo?.region}<br />
                                    {intel.profile?.skill_level}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, title, value, color }) {
    return (
        <div className="bg-dark p-4 rounded-lg border border-slate-800 shadow flex items-center gap-4">
            <div className={`p-3 rounded-full bg-slate-900 ${color}`}>
                {icon}
            </div>
            <div>
                <h3 className="text-[10px] md:text-xs text-slate-400 font-bold tracking-wider">{title}</h3>
                <p className={`text-xl md:text-2xl font-mono ${color}`}>{value}</p>
            </div>
        </div>
    );
}
