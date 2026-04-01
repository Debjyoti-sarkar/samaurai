# KAVACH SENTINEL

**AI-powered Financial Honeypot for detecting enemy infiltration inside military payment networks.**

## 🎯 Overview
Kavach Sentinel is a secure military financial network simulation with embedded honeypots. It silently detects when unauthorized entities access honeypot identities, tracks attacker behavior, and displays threat intelligence on a real-time React dashboard using WebSocket alerts.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express, MySQL, WebSockets, AES-256 (aes-js)
- **Frontend:** React (Vite), Tailwind CSS, Lucide React
- **Logic / Data Gen:** Python (Faker, PyMySQL)

## 🚀 Setup Instructions

### 1. Database (MySQL)
1. Ensure MySQL is installed and running (`root` user, no password by default).
2. Execute the `database/schema.sql` file into your local MySQL instance to create the `kavach_sentinel` database and tables.

### 2. Python Honeypot Generator
1. Navigate to the `honeypot-generator` directory.
2. Install dependencies: `pip install -r requirements.txt`
3. Run the generator: `python generator.py`
   *(This populates the database with realistic soldier profiles and injects the honeypots).*

### 3. Backend (Node.js API)
1. Navigate to the `backend` directory.
2. Ensure you have the `.env` file containing `DB_USER` and `DB_PASSWORD`.
3. Install dependencies: `npm install`
4. Start the server: `npm start`
   *(API runs on `http://localhost:5000`)*

### 4. Frontend (React Dashboard)
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Start the dashboard: `npm run dev`
   *(Runs on `http://localhost:5173`)*

## 🎬 Demo Mode (Testing the Honeypot)
1. Open the React Dashboard (`http://localhost:5173`).
2. On the left side, locate the **Infiltration Simulator** (Demo Panel).
3. Click "EXTRACT" on any of the loaded personnel records simulating an attacker data dump.
4. **If a standard record is accessed:** The data is fetched normally without raising an alarm.
5. **If a HONEYPOT is accessed:** 
   - A silent encrypted payload is logged and broadcast via WebSockets to the Dashboard.
   - The map radar visually pulses a threat marker.
   - Attack tracking details (Simulated IP, Browser Agent, Risk Level, Target) are listed in the **Live Threat Intel** feed.

### Security Implementation Note:
The intrusion alert payload is encrypted from the Node.js backend using AES-256 before being broadcast over WebSockets, ensuring network sniffers cannot read the alerting mechanism in transit or spoof the alerts.
