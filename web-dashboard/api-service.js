/**
 * API Service - Intelligence Platform Communication
 * Handles all backend API calls with authentication
 */

class APIService {
    constructor() {
        this.baseURL = localStorage.getItem('apiBaseURL') || 'http://localhost:5000';
        this.token = localStorage.getItem('authToken');
        this.timeout = 15000;
    }

    setBaseURL(url) {
        this.baseURL = url;
        localStorage.setItem('apiBaseURL', url);
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}/api/intelligence${endpoint}`, {
                ...options,
                headers: this.getHeaders(),
                timeout: this.timeout,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Graph Endpoints
    async getGraphRelationships() {
        return this.request('/graph/relationships');
    }

    async getUserDevices(userId) {
        return this.request(`/graph/user/${userId}/devices`);
    }

    async getDeviceUsers(deviceId) {
        return this.request(`/graph/device/${deviceId}/users`);
    }

    async getGraphClusters() {
        return this.request('/graph/clusters');
    }

    async getGraphStats() {
        return this.request('/graph/stats');
    }

    // Risk Endpoints
    async evaluateTransactionRisk(data) {
        return this.request('/risk/evaluate-transaction', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async evaluateUserRisk(userId) {
        return this.request(`/risk/user/${userId}`, { method: 'GET' });
    }

    async getRiskAssessment(assessmentId) {
        return this.request(`/risk/assessment/${assessmentId}`);
    }

    // Event Endpoints
    async createEvent(data) {
        return this.request('/events/create', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getUserEvents(userId) {
        return this.request(`/events/user/${userId}`);
    }

    async correlateUserEvents(userId) {
        return this.request(`/events/correlate/${userId}`, { method: 'POST' });
    }

    async getEventPatterns() {
        return this.request('/events/patterns');
    }

    // Case Endpoints
    async createCase(data) {
        return this.request('/cases/create', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getCases() {
        return this.request('/cases');
    }

    async getCase(caseId) {
        return this.request(`/cases/${caseId}`);
    }

    async updateCaseStatus(caseId, status) {
        return this.request(`/cases/${caseId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    }

    async addCaseEvidence(caseId, evidence) {
        return this.request(`/cases/${caseId}/evidence`, {
            method: 'POST',
            body: JSON.stringify(evidence),
        });
    }

    // Automation Endpoints
    async createAutomationRule(data) {
        return this.request('/automation/rules', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getAutomationRules() {
        return this.request('/automation/rules');
    }

    async evaluateAutomation(data) {
        return this.request('/automation/evaluate', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Health Check
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL}/`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Global instance
const apiService = new APIService();
