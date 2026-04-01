import React from 'react';
import { AlertCircle, Terminal, MapPin } from 'lucide-react';

export default function AlertLogs({ alerts }) {
    if (alerts.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-center gap-3">
                <AlertCircle className="w-8 h-8 opacity-50" />
                <p className="text-sm">Monitoring network traffic.<br />No intrusions detected.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {alerts.map((alert, idx) => (
                <div key={alert.intrusionId || idx} className="bg-slate-900 border border-slate-800 p-3 rounded shadow animate-[fadeIn_0.5s_ease-out]">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>
                            <span className="text-xs font-bold text-danger tracking-wider">HONEYPOT ACCESSED</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-2 text-xs text-slate-400 font-mono bg-black/40 p-2 rounded">
                        <div className="col-span-1 md:col-span-2 flex border-b border-slate-800 pb-1 mb-1">
                            <span className="text-slate-500 w-20">TARGET:</span>
                            <span className="text-primary">{alert.honeypotId}</span>
                        </div>

                        <div className="flex flex-col">
                            <span className="text-slate-600 text-[10px]">ATTACKER IP</span>
                            <span className="text-yellow-500">{alert.fingerprint?.ip || 'UNKNOWN'}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-600 text-[10px]">RISK</span>
                            <span className={alert.riskLevel === 'CRITICAL' ? 'text-danger font-bold' : 'text-orange-500 font-bold'}>
                                {alert.riskLevel}
                            </span>
                        </div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-500 break-all bg-slate-950 p-2 rounded border border-slate-800 flex flex-col gap-1">
                        <div className="flex gap-1 items-start">
                            <Terminal className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
                            <span className="opacity-70">{alert.fingerprint?.userAgent || 'Unknown Agent'}</span>
                        </div>
                        <div className="flex gap-1 items-center">
                            <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                            <span className="opacity-70 text-slate-400">{alert.fingerprint?.method} {alert.fingerprint?.path}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
