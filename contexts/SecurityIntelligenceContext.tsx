import React, { createContext, useContext, useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';

type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface AlertItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  severity: Severity;
  icon: keyof typeof Feather.glyphMap;
  geoPoint?: { x: number; y: number };
}

interface SecurityIntelligenceState {
  riskScore: number;
  targetRisk: number;
  fraudAttempts: number[];
  otpUsage: number[];
  alerts: AlertItem[];
  threatsDetected: number;
  devicesMonitored: number;
  systemState: "SECURE" | "ELEVATED RISK" | "UNDER ATTACK" | "RECOVERING";
  triggerAction: (actionId: string, alertId: string) => void;
}

const SecurityIntelligenceContext = createContext<SecurityIntelligenceState>({
  riskScore: 0,
  targetRisk: 0,
  fraudAttempts: [],
  otpUsage: [],
  alerts: [],
  threatsDetected: 0,
  devicesMonitored: 0,
  systemState: "SECURE",
  triggerAction: () => {},
});

export const useSecurityIntelligence = () => useContext(SecurityIntelligenceContext);

const INITIAL_ALERTS: AlertItem[] = [
  { id: "al-initial-1", type: "IDLE", title: "Monitoring Active", description: "Intelligence feed established. Awaiting events.", timestamp: "Just now", severity: "LOW", icon: "radio", geoPoint: { x: 50, y: 50 } },
];

const SCENARIOS = [
  {
    type: "SUSPICIOUS_LOGIN",
    title: "Suspicious Login",
    description: "Account accessed from an unrecognized IP in Moscow, Russia.",
    severity: "HIGH" as Severity,
    icon: "map-pin" as const,
    riskDelta: 20,
    addsAnomaly: true,
    addsOtp: false,
    geoPoint: { x: 65, y: 30 }
  },
  {
    type: "OTP_INTERCEPT",
    title: "OTP Access by Unknown App",
    description: "Suspicious app 'FreeGames' attempted to read SMS inbox.",
    severity: "HIGH" as Severity,
    icon: "shield-off" as const,
    riskDelta: 30,
    addsAnomaly: true,
    addsOtp: true,
    geoPoint: { x: 65, y: 30 }
  },
  {
    type: "NEW_DEVICE",
    title: "New Device Detected",
    description: "Login from generic Android device (Chrome 114).",
    severity: "MEDIUM" as Severity,
    icon: "smartphone" as const,
    riskDelta: 10,
    addsAnomaly: false,
    addsOtp: false,
    geoPoint: { x: 75, y: 40 }
  },
  {
    type: "LARGE_TRANSFER",
    title: "Large Transaction Initiated",
    description: "Transfer of ₹50,000 sent to a newly added beneficiary.",
    severity: "MEDIUM" as Severity,
    icon: "arrow-up-right" as const,
    riskDelta: 15,
    addsAnomaly: true,
    addsOtp: true,
    geoPoint: { x: 35, y: 65 }
  },
  {
    type: "NORMAL_OTP",
    title: "Standard Authentication",
    description: "User successfully verified using OTP protocol.",
    severity: "LOW" as Severity,
    icon: "message-square" as const,
    riskDelta: -5,
    addsAnomaly: false,
    addsOtp: true,
    geoPoint: { x: 25, y: 45 }
  },
  {
    type: "IDLE",
    title: "No Threats Detected",
    description: "Background sweep completed successfully.",
    severity: "LOW" as Severity,
    icon: "check-circle" as const,
    riskDelta: -10,
    addsAnomaly: false,
    addsOtp: false,
    geoPoint: { x: 25, y: 45 }
  }
];

export const SecurityIntelligenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [riskScore, setRiskScore] = useState(0); 
  const [fraudAttempts, setFraudAttempts] = useState([2, 5, 1, 0, 4, 3, 1]); // 7 days
  const [otpUsage, setOtpUsage] = useState([12, 15, 8, 14, 20, 18, 10]); // 7 days
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);
  const [threatsDetected, setThreatsDetected] = useState(142);
  const [devicesMonitored] = useState(14);

  // Derive target risk from active alerts to make it structured and explainable
  const riskData = React.useMemo(() => {
    let score = 5; // Base inherent risk
    alerts.forEach(alert => {
      switch(alert.type) {
        case "OTP_INTERCEPT": score += 40; break;
        case "NEW_DEVICE": score += 25; break;
        case "SUSPICIOUS_LOGIN": score += 20; break;
        case "LARGE_TRANSFER": score += 15; break;
        default: score += 0;
      }
    });

    // Determine semantic system state based on presence of mitigations and raw risk
    if (score >= 75) return { risk: Math.min(100, Math.max(0, score)), state: "UNDER ATTACK" as const };
    if (score >= 40) return { risk: score, state: "ELEVATED RISK" as const };
    
    const isRecovering = alerts.some(a => a.type === "MITIGATION" || a.type === "RESOLVED");
    if (isRecovering && score > 5) return { risk: score, state: "RECOVERING" as const };
    
    return { risk: Math.min(100, Math.max(0, score)), state: isRecovering ? "RECOVERING" as const : "SECURE" as const };
  }, [alerts]);

  const targetRisk = riskData.risk;
  const systemState = riskData.state;

  useEffect(() => {
    const interval = setInterval(() => {
      const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      
      if (scenario.addsAnomaly) {
        setFraudAttempts(prev => {
          const newArray = [...prev];
          newArray[newArray.length - 1] += 1;
          return newArray;
        });
      }
      if (scenario.addsOtp) {
        setOtpUsage(prev => {
          const newArray = [...prev];
          newArray[newArray.length - 1] += 1;
          return newArray;
        });
      }

      if (Math.random() > 0.8) {
         setFraudAttempts(prev => [...prev.slice(1), 0]);
         setOtpUsage(prev => [...prev.slice(1), 5]); 
      }

      if (scenario.severity !== "LOW" || Math.random() > 0.6) {
        if (scenario.severity === "HIGH" || scenario.severity === "MEDIUM") {
          setThreatsDetected(prev => prev + 1);
        }

        const newAlert: AlertItem = {
          id: `ev-${Date.now()}`,
          type: scenario.type,
          title: scenario.title,
          description: scenario.description,
          severity: scenario.severity,
          icon: scenario.icon,
          geoPoint: scenario.geoPoint,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setAlerts(prev => [newAlert, ...prev].slice(0, 15)); // Keep max 15

        // Self-Healing Engine: Auto-Mitigation AI Loop
        if (scenario.severity === "HIGH" || scenario.severity === "MEDIUM") {
          setTimeout(() => {
             // Dispatch: Mitigation in progress
             setAlerts(prev => {
                const threatIdx = prev.findIndex(a => a.id === newAlert.id);
                if (threatIdx === -1) return prev; // User manually dismissed it already

                const mitigatingAlert: AlertItem = {
                  id: `mit-${Date.now()}`,
                  type: "MITIGATION",
                  title: "Mitigation in progress",
                  description: newAlert.type === "OTP_INTERCEPT" ? "Securing OTP channel..." : newAlert.type === "SUSPICIOUS_LOGIN" ? "Blocking malicious IP..." : "Verifying device integrity...",
                  severity: "LOW",
                  icon: "shield",
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
                
                // Remove the threat mathematically reducing the targetRisk and enter RECOVERING
                const updatedList = prev.filter(a => a.id !== newAlert.id);
                return [mitigatingAlert, ...updatedList].slice(0, 15);
             });

             // Finalize: Threat Resolved
             setTimeout(() => {
                setAlerts(prev => {
                   const resolvedAlert: AlertItem = {
                     id: `res-${Date.now()}`,
                     type: "RESOLVED",
                     title: "Threat resolved",
                     description: "System secured. Threat vectors isolated.",
                     severity: "LOW",
                     icon: "check-circle",
                     timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                   };
                   const finalUpdate = prev.filter(a => a.type !== "MITIGATION"); // Cleanup mitigation tag
                   return [resolvedAlert, ...finalUpdate].slice(0, 15);
                });
             }, 6000);
          }, 14000);
        }
      }

    }, 8000); // Slowed down simulation tick so states can breathe 

    return () => clearInterval(interval);
  }, []);

  const triggerAction = (actionId: string, alertId: string) => {
    // Actions like Block/Ignore delete the alert, mathematically dropping the derived risk score!
    setAlerts(prev => prev.filter(a => a.id !== alertId)); 
  };

  return (
    <SecurityIntelligenceContext.Provider value={{
      riskScore,
      targetRisk,
      fraudAttempts,
      otpUsage,
      alerts,
      threatsDetected,
      devicesMonitored,
      systemState,
      triggerAction
    }}>
      {children}
    </SecurityIntelligenceContext.Provider>
  );
};
