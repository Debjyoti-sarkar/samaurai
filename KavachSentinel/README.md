# KAVACH SENTINEL V2

**Advanced Predictive, Deceptive, and Intelligence-Generating Cyber Defense Platform**

## 🎯 V2 Intelligence Upgrades Overview
Kavach Sentinel V2 upgrades the static honeypot into an active counter-intelligence weapon. The platform now features:
- **AI Profiler:** Heuristic/ML engine analyzing attacker speed to determine skill and motive.
- **Geographic Heatmapping:** Live IP tracing plotted intuitively over an abstract node map.
- **Dynamic Deception:** Automatically feeds infinitely generated fake data the deeper an attacker penetrates a honeypot session.
- **Quantum-Resist Shim:** Real data is encapsulated via a theoretical post-quantum wrapper.
- **Insider Threat Monitoring:** Rates normal users when extracting high volumes of safe data.
- **Canary Tokens:** Injects mock PDFs containing IP-tracking triggers into leaked data.
- **Behavioral Biometrics:** Invisible terminal rhythm tracker.

## 🚀 Setup Instructions

*(Note: Requires Node.js and Python installed)*

`cd KavachSentinel`

### 1. Database (MySQL V2)
Import `database/schema_v2.sql` to apply the advanced schemas.

### 2. Python AI Profiling Modules
Ensure requirements installed. The backend Node.js automatically spawns Python sub-processes for ML evaluation from the `/ai-engine` folder when an attack occurs.

### 3. Start Backend & Frontend
Terminal 1: `cd backend && npm install && npm start`
Terminal 2: `cd frontend && npm install && npm run dev`

## 🎬 Advanced Demo Walkthrough
1. Access the React Dashboard. Notice the **Federated Role** switcher at the top.
2. In the **Infiltration Simulator**, simulate clicks as either an `"INTERNAL"` Threat or an direct `"ENEMY"` Threat on the HoneyPot targets.
3. Once an Enemy accesses a target:
   - *Intrusion Core* passes the metrics to *Python Profiler*.
   - *Active Counterintel Engine* supplies the attacker with a fake Dossier payload containing a Canary document.
   - The *Heatmap* triggers and plots the origin.
4. Watch the terminal logs on the Demo Panel simulate downloading the Canary Document. The Dashboard immediately reacts to the tripped Canary Trace.
