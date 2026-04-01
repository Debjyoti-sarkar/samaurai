const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { triggerIntrusionAlert } = require('../services/detection');
const { decryptPayload } = require('../services/encryption');
const { simulateLatticeEncryption } = require('../services/quantum_shim');
const { checkInsiderThreat, runCounterIntel } = require('../services/counterintel');
const { triggerCanaryHit } = require('../services/canary');
const { encodeMessageToDecimals, decodeMessageFromDecimals } = require('../services/stegano');
// GET all soldiers (Simulated directory)
router.get('/soldiers', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, rank_title, unit, location FROM soldiers');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET specific soldier details
router.get('/soldier/:id', async (req, res) => {
    const soldierId = req.params.id;
    const userId = req.headers['x-user-id'] || 'ANON-101'; // Simulated user identification

    try {
        // Run insider threat logic on all accesses
        await checkInsiderThreat(req, userId);

        const [rows] = await db.query('SELECT * FROM soldiers WHERE id = ?', [soldierId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Soldier not found' });
        }

        const soldier = rows[0];

        // INTRUSION DETECTION: Check if honeypot
        if (soldier.is_honeypot) {
            // Silently trigger alert
            triggerIntrusionAlert(req, soldierId, req.wss).catch(err => console.error(err));

            // AUTOMATED COUNTERINTEL: Generate and append engaging fake data + run profiling
            const fakeIntel = await runCounterIntel(req, soldierId, req.wss);
            soldier.classified_data = fakeIntel; // Serve the dynamic honeypot data
        } else {
            // QUANTUM RESISTANT ENCRYPTION (Simulation) applied to highly sensitive real data
            soldier.quantum_protected_salary = simulateLatticeEncryption({ salary: soldier.salary });
            delete soldier.salary; // Obfuscate true value under standard protocol
        }

        // Return data - ensure not to leak is_honeypot flag
        delete soldier.is_honeypot;

        // Fetch transactions
        const [txs] = await db.query('SELECT id, amount, transaction_type, description, transaction_date FROM transactions WHERE soldier_id = ? ORDER BY transaction_date DESC LIMIT 10', [soldierId]);
        soldier.recent_transactions = txs;

        res.json(soldier);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Route for handling fake PDF downloads (Canary Tokens)
router.get('/documents/secure/:tokenId', async (req, res) => {
    const token = req.params.tokenId;
    await triggerCanaryHit(token, req, req.wss);

    // Serve a literal dummy response posing as a corrupt/secure binary
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from("%PDF-1.4\n%TRAPPED-BY-KAVACH\nEOF", 'utf-8'));
});

// Decrypt endpoint for dashboard testing / demo purposes
router.post('/decrypt-alert', express.json(), (req, res) => {
    const { encryptedData } = req.body;
    if (!encryptedData) {
        return res.status(400).json({ error: 'Missing encrypted data' });
    }
    const decrypted = decryptPayload(encryptedData);
    if (decrypted) {
        res.json({ success: true, payload: decrypted });
    } else {
        res.status(400).json({ error: 'Decryption failed' });
    }
});

// GET Security Intelligence Logs (For Dashboard Historical View)
router.get('/threat-intel', async (req, res) => {
    try {
        const [logs] = await db.query('SELECT * FROM intrusions ORDER BY access_time DESC LIMIT 50');
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// POST a new transaction
router.post('/transaction', async (req, res) => {
    const { soldier_id, amount, transaction_type, description } = req.body;
    try {
        await db.query(
            'INSERT INTO transactions (soldier_id, amount, transaction_type, description) VALUES (?, ?, ?, ?)',
            [soldier_id, amount, transaction_type, description]
        );
        res.json({ success: true, message: 'Transaction successful' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
