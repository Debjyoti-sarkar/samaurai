const crypto = require('crypto');

function generateDeepFakeData(honeypotId, depthLayer) {
    // Dynamic generation based on depth of intrusion. 
    // The longer they stay, the more complex fake data we serve.
    switch (depthLayer) {
        case 1:
            return {
                notice: "CONFIDENTIAL LEVEL 1",
                recent_deployments: ["Sector 7", "Base Alpha"],
                clearance: "LEVEL_3"
            };
        case 2:
            return {
                notice: "CONFIDENTIAL LEVEL 2",
                weapons_authorization: ["ASSAULT", "FIELD_INTEL"],
                squad_composition: "4-Man Recon"
            };
        case 3:
            return {
                target_briefing: "Operation Silent Strike",
                coordinates: `28.6139, 77.2090`,
                logistics_keys: crypto.randomBytes(32).toString('hex')
            };
        default:
            return { error: "Access Denied" };
    }
}

module.exports = { generateDeepFakeData };
