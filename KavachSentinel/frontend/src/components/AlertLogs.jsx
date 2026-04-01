import React from 'react';
import { AlertCircle, Terminal, MapPin, BrainCircuit } from 'lucide-react';

export default function AlertLogs({ alerts, aiIntel }) {
    if (alerts.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-center gap-3">
                <AlertCircle className="w-8 h-8 opacity-30" />
                <p className="text-xs uppercase tracking-widest font-mono">Grid Secure.<br />Awaiting Intelligence Triggers.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3 custom-scrollbar">
            {alerts.map((alert, idx) => {

                const ip = alert.fingerprint?.ip || alert.ip || 'UNKNOWN';
                const profile = aiIntel[ip]?.profile;
                const isCanary = alert.tokenId !== undefined;

                return (
                    <div key={alert.intrusionId || alert.tokenId || idx} className={`bg-gradient-to-b from-slate-900 to-black border ${isCanary ? 'border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 'border-slate-800'} p-3 rounded shadow-lg animate-[fadeIn_0.5s_ease-out]`}>

                        {/* Header */}
                        <div className="flex justify-between items-start mb-2 border-b border-slate-800/50 pb-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isCanary ? 'bg-yellow-500' : 'bg-danger'} animate-pulse shadow-[0_0_5px_currentColor]`}></span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isCanary ? 'text-yellow-500' : 'text-danger'}`}>
                                    {isCanary ? 'CANARY DOCUMENT TRIPPED' : 'HONEYPOT ACCESSED'}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
                                {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                        </div>

                        {/* Core Intel */}
                        <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs text-slate-400 font-mono bg-[#050b14] p-2 rounded border border-slate-800/50 my-2">
                            <div className="col-span-2 flex justify-between">
                                <span className="text-slate-600 text-[9px] uppercase tracking-widest">Target Vectoring:</span>
                                <span className="text-cyan-400 font-bold">{alert.honeypotId || alert.tokenId}</span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-slate-600 text-[9px] uppercase tracking-widest">Attacker Origin IP</span>
                                <span className="text-white bg-slate-800 px-1 rounded-sm block w-fit mt-0.5">{ip}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-slate-600 text-[9px] uppercase tracking-widest">Threat Class</span>
                                <span className={alert.riskLevel === 'CRITICAL' ? 'text-danger font-bold' : 'text-orange-500 font-bold'}>
                                    {alert.riskLevel || 'EVALUATING'}
                                </span>
                            </div>
                        </div>

                        {/* AI Profiler (If available) */}
                        {profile && (
                            <div className="mt-2 bg-indigo-950/30 border border-indigo-500/20 p-2 rounded-md">
                                <div className="flex items-center gap-1 mb-1">
                                    <BrainCircuit className="w-3 h-3 text-indigo-400" />
                                    <span className="text-[9px] font-black tracking-widest text-indigo-400">AI PROFILER ENGAGED</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono mt-1">
                                    <span className="text-slate-500">Classification:</span>
                                    <span className={profile.skill_level?.includes('EXPERT') ? 'text-danger' : 'text-yellow-500'}>
                                        {profile.skill_level}
                                    </span>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-slate-500">Probable Motive:</span>
                                    <span className="text-indigo-300 leading-tight text-right w-3/4">{profile.likely_motive}</span>
                                </div>
                            </div>
                        )}

                        {/* Terminal Extracted Payload */}
                        <div className="mt-2 text-[9px] text-slate-500 break-all bg-black p-2 rounded border border-slate-800/80 flex flex-col gap-1.5 font-mono">
                            <div className="flex gap-1.5 items-start">
                                <Terminal className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
                                <span className="opacity-70">{alert.fingerprint?.userAgent || alert.userAgent || 'Unknown Payload User-Agent'}</span>
                            </div>
                            {!isCanary && (
                                <div className="flex gap-1.5 items-center">
                                    <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                                    <span className="opacity-70 text-slate-500">Method: {alert.fingerprint?.method} Path: {alert.fingerprint?.path}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
