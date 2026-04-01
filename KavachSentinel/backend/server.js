require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Pass WSS to req for the routes to use
app.use((req, res, next) => {
    req.wss = wss;
    next();
});

// Import API routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// General status route
app.get('/status', (req, res) => {
    res.json({ status: 'active', service: 'KAVACH SENTINEL PAYROLL API' });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Security Dashboard connected.');
    ws.on('message', (message) => {
        console.log('Received from dashboard:', message.toString());
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`[KAVACH SENTINEL] Payroll Simulation API running on port ${PORT}`);
});
