const db = require('./db');
const { encryptPayload } = require('./encryption');

// Define risk levels based on behavior
function determineRiskLevel(req) {
    // A simplified heuristics engine
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    if (userAgent.includes('curl') || userAgent.includes('postman') || userAgent.includes('python-requests')) {
        return 'CRITICAL';
    }
    return 'HIGH';
}

// Extract attacker fingerprint
function extractFingerprint(req) {
    return {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown',
        method: req.method,
        path: req.originalUrl,
        headers: req.headers
    };
}

async function triggerIntrusionAlert(req, honeypotId, wss) {
    const fingerprint = extractFingerprint(req);
    const riskLevel = determineRiskLevel(req);
    const behaviorPattern = JSON.stringify(fingerprint);

    // 1. Silent Logging to Database
    let intrusionId = null;
    try {
        const [result] = await db.execute(
            `INSERT INTO intrusions (honeypot_id, ip_address, user_agent, risk_level, behavior_pattern) 
             VALUES (?, ?, ?, ?, ?)`,
            [honeypotId, fingerprint.ip, fingerprint.userAgent, riskLevel, behaviorPattern]
        );
        intrusionId = result.insertId;
        console.log(`[SILENT ALERT] Intrusion logged. ID: ${intrusionId}`);
    } catch (error) {
        console.error("Failed to log intrusion:", error);
    }

    // 2. Encrypt Payload
    const alertPayload = {
        intrusionId,
        honeypotId,
        timestamp: new Date().toISOString(),
        riskLevel,
        fingerprint
    };

    const encryptedData = encryptPayload(alertPayload);

    // 3. Broadcast Alert to Security Dashboard via WebSockets
    if (wss) {
        wss.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
                // Send encrypted payload
                client.send(JSON.stringify({
                    type: 'INTRUSION_ALERT',
                    data: encryptedData
                }));
            }
        });
    }

    return alertPayload;
}

module.exports = {
    triggerIntrusionAlert
};
