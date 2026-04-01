/**
 * Main Application Logic - Intelligence Dashboard
 */

let currentView = 'dashboard';
let realtimeEnabled = false;
let realtimeInterval = null;
let allData = {
    graph: [],
    events: [],
    cases: [],
    risks: [],
    statistics: {}
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('KAVACH Intelligence Dashboard Initialized');
    setupEventListeners();
    initializeCharts();
    await testConnection();
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
            switchView(view);
        });
    });

    // Token input
    document.getElementById('tokenInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            authenticateToken();
        }
    });
}

// ============================================
// Authentication & Connection
// ============================================

async function authenticateToken() {
    const token = document.getElementById('tokenInput').value.trim();
    const apiUrl = document.getElementById('apiUrl').value.trim();

    if (!token) {
        showError('Please enter a JWT token');
        return;
    }

    apiService.setToken(token);
    apiService.setBaseURL(apiUrl);

    try {
        showLoading(true);
        const isHealthy = await apiService.healthCheck();
        if (!isHealthy) {
            throw new Error('Backend API not responding');
        }

        // Test API call
        const response = await apiService.getGraphStats();
        if (response && response.data) {
            updateAuthStatus(true);
            showSuccess('Connected successfully!');
            await loadAllData();
        } else {
            throw new Error('Invalid token or API response');
        }
    } catch (error) {
        showError('Connection failed: ' + error.message);
        updateAuthStatus(false);
    } finally {
        showLoading(false);
    }
}

async function testConnection() {
    try {
        const isHealthy = await apiService.healthCheck();
        updateConnectionStatus(isHealthy);
    } catch (error) {
        updateConnectionStatus(false);
    }
}

function updateAuthStatus(isConnected) {
    const status = document.getElementById('authStatus');
    if (isConnected) {
        status.textContent = '🟢 Connected';
        status.style.color = '#2ECC71';
    } else {
        status.textContent = '🔴 Not Connected';
        status.style.color = '#E74C3C';
    }
}

// ============================================
// View Management
// ============================================

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Hide all nav buttons active state
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected view
    const viewElement = document.getElementById(`${viewName}-view`);
    if (viewElement) {
        viewElement.classList.add('active');
    }

    // Update nav button state
    event.target.classList.add('active');
    currentView = viewName;

    // Load view-specific data
    if (viewName === 'graph') {
        initializeGraph();
    } else if (viewName === 'events') {
        populateEventsTable();
    } else if (viewName === 'cases') {
        populateCasesGrid();
    } else if (viewName === 'risks') {
        populateRisksGrid();
    } else if (viewName === 'analytics') {
        updateAnalytics();
    } else if (viewName === 'dashboard') {
        updateDashboard();
    }
}

// ============================================
// Data Loading
// ============================================

async function loadAllData() {
    showLoading(true);
    try {
        const [graphData, eventsData, casesData] = await Promise.all([
            apiService.getGraphStats().catch(() => null),
            apiService.getEventPatterns().catch(() => null),
            apiService.getCases().catch(() => null),
        ]);

        // Store data
        if (graphData) allData.graph = graphData.data || [];
        if (eventsData) allData.events = eventsData.data || [];
        if (casesData) allData.cases = casesData.data || [];

        // Fetch risk data
        try {
            const riskData = await apiService.getUserRisk('all');
            if (riskData) allData.risks = riskData.data || [];
        } catch (error) {
            console.warn('Could not load risk data:', error);
        }

        // Calculate statistics
        calculateStatistics();
        updateDashboard();
        updateLastUpdateTime();

        showSuccess('Data loaded successfully');
    } catch (error) {
        showError('Failed to load data: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function refreshData() {
    await loadAllData();
}

function calculateStatistics() {
    const stats = {
        totalUsers: new Set(),
        totalDevices: new Set(),
        totalTransactions: 0,
        totalEvents: allData.events.length || 0,
        totalCases: allData.cases.length || 0,
        highRiskCount: 0,
        eventsByType: {},
        casesByStatus: { open: 0, investigating: 0, resolved: 0 },
        riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 }
    };

    // Count entities from graph
    if (allData.graph && Array.isArray(allData.graph)) {
        allData.graph.forEach(rel => {
            if (rel.from) stats.totalUsers.add(rel.from);
            if (rel.to) stats.totalDevices.add(rel.to);
        });
    }

    // Count events by type
    if (Array.isArray(allData.events)) {
        allData.events.forEach(event => {
            stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
        });
    }

    // Count cases by status
    if (Array.isArray(allData.cases)) {
        allData.cases.forEach(case_item => {
            const status = case_item.status || 'open';
            if (stats.casesByStatus[status] !== undefined) {
                stats.casesByStatus[status]++;
            }
        });
    }

    // Count risks
    if (Array.isArray(allData.risks)) {
        allData.risks.forEach(risk => {
            const score = risk.riskScore || 0;
            if (score >= 75) stats.riskDistribution.critical++;
            else if (score >= 50) stats.riskDistribution.high++;
            else if (score >= 25) stats.riskDistribution.medium++;
            else stats.riskDistribution.low++;

            if (score >= 50) stats.highRiskCount++;
        });
    }

    allData.statistics = {
        ...stats,
        totalUsers: stats.totalUsers.size,
        totalDevices: stats.totalDevices.size
    };
}

// ============================================
// Dashboard View
// ============================================

function updateDashboard() {
    const stats = allData.statistics;

    // Update stat cards
    document.getElementById('stat-users').textContent = stats.totalUsers || 0;
    document.getElementById('stat-devices').textContent = stats.totalDevices || 0;
    document.getElementById('stat-transactions').textContent = stats.totalTransactions || 0;
    document.getElementById('stat-risk').textContent = stats.highRiskCount || 0;
    document.getElementById('stat-events').textContent = stats.totalEvents || 0;
    document.getElementById('stat-cases').textContent = stats.totalCases || 0;

    // Update charts
    const chartData = {
        riskDistribution: stats.riskDistribution,
        eventsByType: stats.eventsByType,
        caseStatus: stats.casesByStatus,
        deviceDistribution: { 'Mobile': 45, 'Desktop': 32, 'Tablet': 18, 'Other': 5 }
    };
    chartService.updateAllCharts(chartData);

    // Update recent events
    populateRecentEvents();
}

function populateRecentEvents() {
    const container = document.getElementById('recentEvents');
    if (!Array.isArray(allData.events) || allData.events.length === 0) {
        container.innerHTML = '<p class="empty-state">No events yet</p>';
        return;
    }

    const recent = allData.events.slice(-5).reverse();
    container.innerHTML = recent.map(event => `
        <div class="event-item">
            <div class="event-header">
                <span class="event-type ${event.severity || 'info'}">${event.eventType}</span>
                <span class="event-time">${formatTime(event.timestamp || new Date())}</span>
            </div>
            <div class="event-description">${event.description || 'No description'}</div>
        </div>
    `).join('');
}

// ============================================
// Graph View
// ============================================

async function initializeGraph() {
    if (!document.getElementById('network')) return;

    try {
        showLoading(true);
        graphService.initNetwork('network');

        // Load and display graph data
        const response = await apiService.getGraphRelationships();
        if (response && response.data) {
            graphService.processRelationships(response.data);
            graphService.resetGraph();

            const stats = graphService.getStats();
            document.getElementById('graphStatus').textContent = `🟢 ${stats.totalNodes} nodes, ${stats.totalEdges} edges`;
        }
    } catch (error) {
        showError('Failed to load graph: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function resetGraph() {
    graphService.resetGraph();
}

// ============================================
// Events View
// ============================================

function populateEventsTable() {
    const tbody = document.getElementById('eventsTable');
    if (!Array.isArray(allData.events) || allData.events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No events loaded</td></tr>';
        return;
    }

    tbody.innerHTML = allData.events.map(event => `
        <tr>
            <td class="mono">${event.eventId || event._id?.substring(0, 8) || '--'}</td>
            <td><span class="badge ${event.eventType}">${event.eventType}</span></td>
            <td>${event.userId?.substring(0, 8) || '--'}</td>
            <td><span class="severity ${event.severity || 'info'}">${event.severity || 'Info'}</span></td>
            <td>${event.description || '--'}</td>
            <td>${formatTime(event.timestamp || event.createdAt)}</td>
        </tr>
    `).join('');
}

// ============================================
// Cases View
// ============================================

function populateCasesGrid() {
    const grid = document.getElementById('casesGrid');
    if (!Array.isArray(allData.cases) || allData.cases.length === 0) {
        grid.innerHTML = '<p class="empty-state">No cases loaded</p>';
        return;
    }

    grid.innerHTML = allData.cases.map(case_item => `
        <div class="case-card">
            <div class="case-header">
                <h4>${case_item.title}</h4>
                <span class="status-badge ${case_item.status}">${case_item.status}</span>
            </div>
            <p>${case_item.description}</p>
            <div class="case-meta">
                <span>👤 ${case_item.primaryUser?.substring(0, 8) || '--'}</span>
                <span>⚠️ ${case_item.severity}</span>
            </div>
        </div>
    `).join('');
}

function openNewCaseModal() {
    document.getElementById('newCaseModal').classList.remove('hidden');
}

function closeNewCaseModal() {
    document.getElementById('newCaseModal').classList.add('hidden');
}

async function createCase(event) {
    event.preventDefault();

    const data = {
        title: document.getElementById('caseTitle').value,
        description: document.getElementById('caseDescription').value,
        severity: document.getElementById('caseSeverity').value,
        caseType: 'fraud_investigation'
    };

    try {
        showLoading(true);
        await apiService.createCase(data);
        showSuccess('Case created successfully');
        closeNewCaseModal();
        await loadAllData();
        populateCasesGrid();
    } catch (error) {
        showError('Failed to create case: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// Risk Analysis View
// ============================================

function populateRisksGrid() {
    const grid = document.getElementById('risksGrid');
    if (!Array.isArray(allData.risks) || allData.risks.length === 0) {
        grid.innerHTML = '<p class="empty-state">No risk data loaded</p>';
        return;
    }

    grid.innerHTML = allData.risks.map(risk => {
        const score = risk.riskScore || 0;
        const level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

        return `
            <div class="risk-card ${level}">
                <div class="risk-header">
                    <h4>${risk.entityId?.substring(0, 12) || '--'}</h4>
                    <div class="risk-score">${score}%</div>
                </div>
                <div class="risk-bar">
                    <div class="risk-fill" style="width: ${score}%"></div>
                </div>
                <p class="risk-level">${level.toUpperCase()}</p>
                <div class="risk-factors">
                    ${(risk.factors || []).slice(0, 3).map(f => `<span>${f}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function filterRisks() {
    // TODO: Implement filtering
}

// ============================================
// Analytics View
// ============================================

function updateAnalytics() {
    // Populate top patterns
    const patterns = document.getElementById('topPatterns');
    patterns.innerHTML = `
        <div class="pattern">
            <strong>Device Abuse:</strong> 3 users sharing same device
        </div>
        <div class="pattern">
            <strong>Rapid Transactions:</strong> 5+ transactions in 1 minute
        </div>
        <div class="pattern">
            <strong>Geo-Anomaly:</strong> Login from multiple countries in 1 hour
        </div>
    `;

    // Populate suspicious clusters
    const clusters = document.getElementById('suspiciousClusters');
    clusters.innerHTML = `
        <div class="cluster">
            <strong>Cluster A:</strong> 4 users, 2 devices - Medium risk
        </div>
        <div class="cluster">
            <strong>Cluster B:</strong> 6 users, 1 device - High risk
        </div>
    `;

    // Populate automation stats
    const stats = document.getElementById('automationStats');
    stats.innerHTML = `
        <div class="stat">Rules Defined: 12</div>
        <div class="stat">Rules Executed: 47</div>
        <div class="stat">Avg Execution Time: 245ms</div>
    `;
}

// ============================================
// Utility Functions
// ============================================

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.remove('hidden');
    } else {
        spinner.classList.add('hidden');
    }
}

function showError(message) {
    const alert = document.getElementById('errorAlert');
    const message_elem = document.getElementById('errorMessage');
    message_elem.textContent = message;
    alert.classList.remove('hidden');
    setTimeout(() => alert.classList.add('hidden'), 5000);
}

function showSuccess(message) {
    // Create a temporary success message
    const div = document.createElement('div');
    div.className = 'alert alert-success';
    div.textContent = '✓ ' + message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function closeError() {
    document.getElementById('errorAlert').classList.add('hidden');
}

function updateConnectionStatus(isConnected) {
    const status = document.getElementById('backendStatus');
    status.textContent = isConnected ? '🟢' : '🔴';
}

function updateLastUpdateTime() {
    const time = new Date().toLocaleTimeString();
    document.getElementById('lastUpdate').textContent = time;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
}

function toggleRealtime() {
    realtimeEnabled = !realtimeEnabled;
    if (realtimeEnabled) {
        realtimeInterval = setInterval(() => {
            loadAllData();
        }, 5000);
        showSuccess('Real-time monitoring enabled');
    } else {
        clearInterval(realtimeInterval);
        showSuccess('Real-time monitoring disabled');
    }
}

function generateReport() {
    const report = JSON.stringify(allData, null, 2);
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intelligence-report-${new Date().getTime()}.json`;
    link.click();
}

function exportData() {
    generateReport();
}

async function initializeCharts() {
    chartService.createRiskChart({ critical: 2, high: 5, medium: 8, low: 15 });
    chartService.createEventsChart({ login: 25, transaction: 18, device: 12, session: 8 });
    chartService.createCaseChart({ open: 3, investigating: 2, resolved: 15 });
    chartService.createDeviceChart({ Mobile: 45, Desktop: 32, Tablet: 18, Other: 5 });
}
