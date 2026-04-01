const db = require('./db');
const { generateDeepFakeData } = require('./deepener');
const { generateCanaryToken } = require('./canary');
const { spawn } = require('child_process');
const path = require('path');

// Simulate Insider Threat Monitoring
async function checkInsiderThreat(req, userId) {
    const role = req.headers['x-agency-role'] || 'UNKNOWN';

    // Log access
    await db.execute(
        `INSERT INTO insider_logs (agency_role, user_id) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE records_accessed = records_accessed + 1, access_time = CURRENT_TIMESTAMP`,
        [role, userId]
    );

    // Pseudo threat scoring
    const [rows] = await db.execute(`SELECT records_accessed FROM insider_logs WHERE user_id = ?`, [userId]);
    if (rows.length > 0 && rows[0].records_accessed > 50) {
        console.warn(`[INSIDER THREAT DETECTED] High volume access from user ${userId} (${role})`);

        await db.execute(`UPDATE insider_logs SET threat_score = ? WHERE user_id = ?`, [85, userId]);
        return true;
    }
    return false;
}

// Call Python AI Profiler
function profileAttackerBehavior(ip, wss) {
    const profilerScript = path.join(__dirname, '../../ai-engine/profiler.py');
    const geoScript = path.join(__dirname, '../../ai-engine/geo_cluster.py');

    // Simulate metrics
    const mockMetrics = JSON.stringify({
        metrics: { requests_per_minute: Math.floor(Math.random() * 80) + 10, accessed_sensitive: true }
    });

    const pythonProcess = spawn('python', [profilerScript, mockMetrics]);
    const geoProcess = spawn('python', [geoScript, ip]);

    let profileData = {};
    let geoRegion = {};

    geoProcess.stdout.on('data', (data) => {
        try { geoRegion = JSON.parse(data.toString()); } catch (e) { }
    });

    pythonProcess.stdout.on('data', (data) => {
        try {
            profileData = JSON.parse(data.toString());

            // Broadcast AI intel back to React Dashboard
            if (wss && profileData.skill_level) {
                wss.clients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({
                            type: 'AI_INTEL_UPDATE',
                            data: { ip, profile: profileData, geo: geoRegion }
                        }));
                    }
                });
            }
        } catch (e) { console.error("Parse Error from AI Engine:", e) }
    });
}

// Counter Intelligence Engine Linker
async function runCounterIntel(req, honeypotId, wss) {
    const ip = req.ip || req.connection.remoteAddress;

    // 1. Profile Attack
    profileAttackerBehavior(ip, wss);

    // 2. Deepen Honeypot (Generate deeper fake payload)
    // We arbitrarily simulate "Session depth layer" as randomly 1, 2, or 3
    const layer = Math.floor(Math.random() * 3) + 1;
    const fakeData = generateDeepFakeData(honeypotId, layer);

    // 3. Inject Canary Token into payload to track if they download it
    const canaryLink = await generateCanaryToken(honeypotId);
    fakeData.downloadable_dossier = canaryLink;

    return fakeData;
}

module.exports = {
    checkInsiderThreat,
    runCounterIntel
};
