/**
 * Chart Service - Analytics Visualization
 * Handles Chart.js charts for data visualization
 */

class ChartService {
    constructor() {
        this.charts = {};
    }

    /**
     * Create Risk Distribution Chart
     */
    createRiskChart(data) {
        const ctx = document.getElementById('riskChart');
        if (!ctx) return;

        if (this.charts.risk) {
            this.charts.risk.destroy();
        }

        this.charts.risk = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data: [
                        data.critical || 0,
                        data.high || 0,
                        data.medium || 0,
                        data.low || 0
                    ],
                    backgroundColor: [
                        '#E74C3C',
                        '#E67E22',
                        '#F39C12',
                        '#27AE60'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff',
                            padding: 15,
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create Events Chart
     */
    createEventsChart(data) {
        const ctx = document.getElementById('eventsChart');
        if (!ctx) return;

        if (this.charts.events) {
            this.charts.events.destroy();
        }

        this.charts.events = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Events',
                    data: Object.values(data),
                    backgroundColor: [
                        '#3498DB',
                        '#2ECC71',
                        '#F39C12',
                        '#E74C3C',
                        '#9B59B6'
                    ],
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#fff' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#fff' }
                    }
                }
            }
        });
    }

    /**
     * Create Case Status Chart
     */
    createCaseChart(data) {
        const ctx = document.getElementById('caseChart');
        if (!ctx) return;

        if (this.charts.cases) {
            this.charts.cases.destroy();
        }

        this.charts.cases = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Open', 'Investigating', 'Resolved'],
                datasets: [{
                    data: [
                        data.open || 0,
                        data.investigating || 0,
                        data.resolved || 0
                    ],
                    backgroundColor: [
                        '#E74C3C',
                        '#F39C12',
                        '#27AE60'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff',
                            padding: 15,
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create Device Distribution Chart
     */
    createDeviceChart(data) {
        const ctx = document.getElementById('deviceChart');
        if (!ctx) return;

        if (this.charts.devices) {
            this.charts.devices.destroy();
        }

        this.charts.devices = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Device Usage',
                    data: Object.values(data),
                    borderColor: '#2ECC71',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#fff'
                        }
                    }
                },
                scales: {
                    r: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#fff' }
                    }
                }
            }
        });
    }

    /**
     * Create Time Series Chart
     */
    createTimeSeriesChart(data, title = 'Events Over Time') {
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${Date.now()}`;
        
        return new Chart(canvas, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: title,
                    data: data.values,
                    borderColor: '#3498DB',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#fff' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#fff' }
                    }
                }
            }
        });
    }

    /**
     * Update all charts
     */
    updateAllCharts(data) {
        if (data.riskDistribution) {
            this.createRiskChart(data.riskDistribution);
        }
        if (data.eventsByType) {
            this.createEventsChart(data.eventsByType);
        }
        if (data.caseStatus) {
            this.createCaseChart(data.caseStatus);
        }
        if (data.deviceDistribution) {
            this.createDeviceChart(data.deviceDistribution);
        }
    }
}

// Global instance
const chartService = new ChartService();
