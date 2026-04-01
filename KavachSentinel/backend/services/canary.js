const db = require('./db');
const { encryptPayload } = require('./encryption');

/**
 * Canary Token Service (Tracking Fake PDFs)
 * Automatically generates a uniquely verifiable URL to insert into honeypots.
 */

async function generateCanaryToken(honeypotId) {
    const tokenId = require('crypto').randomBytes(16).toString('hex');
    const docName = `REPORT_Q4_INTEL_${Math.floor(Math.random() * 1000)}.pdf`;

    // Log token creation
    try {
        await db.execute(
            `INSERT INTO canary_tokens (id, document_name, honeypot_id) VALUES (?, ?, ?)`,
            [tokenId, docName, honeypotId]
        );
    } catch (e) {
        console.error("Failed to inject canary token", e);
    }

    // The exposed route for the attacker
    return `/api/documents/secure/${tokenId}`;
}

async function triggerCanaryHit(tokenId, req, wss) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    try {
        await db.execute(
            `INSERT INTO canary_hits (token_id, ip_address, user_agent) VALUES (?, ?, ?)`,
            [tokenId, ip, userAgent]
        );

        // Broadcast the hit alerting the dashboard
        if (wss) {
            const alertPayload = {
                type: 'CANARY_TRIPPED',
                timestamp: new Date().toISOString(),
                tokenId,
                ip,
                userAgent
            };
            const encryptedData = encryptPayload(alertPayload);
            wss.clients.forEach(client => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(JSON.stringify({ type: 'INTRUSION_ALERT', data: encryptedData }));
                }
            });
        }

    } catch (e) {
        console.error("Failed to log canary hit", e);
    }
}

module.exports = {
    generateCanaryToken,
    triggerCanaryHit
};
