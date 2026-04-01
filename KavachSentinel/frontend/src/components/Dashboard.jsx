import React from 'react';
import { Target, Activity, ShieldAlert, Cpu } from 'lucide-react';

export default function Dashboard({ alerts }) {
    const activeThreats = alerts.filter(a => a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH').length;

    return (
        <div className="flex-1 flex flex-col gap-4">
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Target />} title="HONEYPOTS ACTIVE" value="10" color="text-primary" />
                <StatCard icon={<ShieldAlert />} title="INTRUSIONS" value={alerts.length} color="text-danger" />
                <StatCard icon={<Activity />} title="ACTIVE THREATS" value={activeThreats} color="text-orange-500" />
                <StatCard icon={<Cpu />} title="SYSTEM ENGINE" value="ONLINE" color="text-primary" />
            </div>

            {/* Map / Visualization Area */}
            <div className="flex-1 bg-dark border border-slate-800 rounded-lg relative overflow-hidden flex flex-col shadow-inner min-h-[300px]">
                <div className="absolute inset-0 map-grid opacity-30 pointer-events-none"></div>
                <div className="p-3 border-b border-slate-800 relative z-10 flex justify-between items-center bg-dark/80 backdrop-blur-sm">
                    <h2 className="text-sm font-bold tracking-widest text-slate-400">GEOLOCATION TRACKING RADAR</h2>
                    <span className="text-xs text-slate-500 font-mono">NODE: REGION-ALPHA</span>
                </div>

                {/* Mock Map View */}
                <div className="flex-1 relative p-4 flex items-center justify-center overflow-hidden">
                    {/* Radar circle effect */}
                    <div className="absolute w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full border border-primary/20 flex items-center justify-center">
                        <div className="absolute w-[200px] h-[200px] md:w-[350px] md:h-[350px] rounded-full border border-primary/20"></div>
                        <div className="absolute w-[100px] h-[100px] md:w-[150px] md:h-[150px] rounded-full border border-primary/30"></div>
                        <div className="absolute w-[50px] h-[50px] rounded-full border border-primary/40 bg-primary/5"></div>
                        {/* Scanner line */}
                        <div className="w-[150px] md:w-[250px] h-1 bg-gradient-to-r from-transparent to-primary absolute origin-left animate-[spin_4s_linear_infinite] rounded-full" style={{ left: '50%' }}></div>
                    </div>

                    {/* Plot Alerts on Map randomly */}
                    {alerts.slice(0, 15).map((alert, idx) => {
                        const top = Math.random() * 80 + 10;
                        const left = Math.random() * 80 + 10;

                        return (
                            <div key={idx} className="absolute w-3 h-3 bg-danger rounded-full shadow-[0_0_10px_#ef4444] animate-pulse"
                                style={{ top: `${top}%`, left: `${left}%` }} title={`Intrusion ID: ${alert.intrusionId}`}>
                                <div className="absolute w-8 h-8 rounded-full border border-danger/50 -top-2.5 -left-2.5 animate-ping"></div>
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
