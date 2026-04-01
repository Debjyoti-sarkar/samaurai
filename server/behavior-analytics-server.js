/**
 * KAVACH Behavior Analytics API - Node.js Version
 * Real-time behavioral biometric analysis for fraud detection
 * Run with: node behavior-analytics-server.js
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Store user baselines
const userBaselines = new Map();
const START_TIME = Date.now();

// ==================== CURSOR ANALYZER ====================

class CursorAnalyzer {
    extractFeatures(points) {
        if (!points || points.length < 5) {
            return this.emptyFeatures();
        }

        const x = points.map(p => p.x);
        const y = points.map(p => p.y);
        const t = points.map(p => p.timestamp);

        // Normalize timestamps
        const tNorm = t.map(ti => (ti - t[0]) / 1000);

        // Calculate velocities
        const velocities = [];
        const directions = [];
        const accelerations = [];

        for (let i = 1; i < points.length; i++) {
            const dx = x[i] - x[i-1];
            const dy = y[i] - y[i-1];
            const dt = Math.max(tNorm[i] - tNorm[i-1], 0.001);

            const dist = Math.sqrt(dx*dx + dy*dy);
            const vel = dist / dt;
            velocities.push(vel);
            directions.push(Math.atan2(dy, dx));

            if (velocities.length > 1) {
                const accel = (velocities[velocities.length-1] - velocities[velocities.length-2]) / dt;
                accelerations.push(accel);
            }
        }

        // Statistical features
        const meanVelocity = this.mean(velocities);
        const stdVelocity = this.std(velocities);
        const maxVelocity = Math.max(...velocities);
        const minVelocity = Math.min(...velocities);

        // Calculate total path distance
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            totalDistance += Math.sqrt(
                Math.pow(x[i] - x[i-1], 2) + Math.pow(y[i] - y[i-1], 2)
            );
        }

        // Direct distance (start to end)
        const directDistance = Math.sqrt(
            Math.pow(x[x.length-1] - x[0], 2) + Math.pow(y[y.length-1] - y[0], 2)
        );

        // Directness ratio (1 = perfectly straight)
        const directnessRatio = directDistance > 0 ?
            Math.min(directDistance / Math.max(totalDistance, 0.001), 1) : 0;

        // Calculate curvature
        const curvatures = [];
        for (let i = 1; i < directions.length; i++) {
            let angleDiff = directions[i] - directions[i-1];
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            curvatures.push(Math.abs(angleDiff));
        }
        const meanCurvature = curvatures.length > 0 ? this.mean(curvatures) : 0;

        // Smoothness (inverse of jerk)
        const jerks = [];
        for (let i = 1; i < accelerations.length; i++) {
            const dt = Math.max(tNorm[i+1] - tNorm[i], 0.001);
            jerks.push(Math.abs(accelerations[i] - accelerations[i-1]) / dt);
        }
        const meanJerk = jerks.length > 0 ? this.mean(jerks) : 0;
        const smoothness = 1 / (1 + meanJerk / 1000);

        // Hesitation detection
        const hesitations = velocities.filter(v => v < meanVelocity * 0.1).length;
        const hesitationRatio = hesitations / Math.max(velocities.length, 1);

        // Velocity variability coefficient
        const velocityCV = stdVelocity / Math.max(meanVelocity, 0.001);

        // Pressure analysis (if available)
        const pressures = points.filter(p => p.pressure != null).map(p => p.pressure);
        const meanPressure = pressures.length > 0 ? this.mean(pressures) : 0.5;
        const pressureVariability = pressures.length > 0 ? this.std(pressures) : 0;

        return {
            velocity: {
                mean: Number(meanVelocity.toFixed(2)),
                std: Number(stdVelocity.toFixed(2)),
                max: Number(maxVelocity.toFixed(2)),
                min: Number(minVelocity.toFixed(2)),
                cv: Number(velocityCV.toFixed(3))
            },
            acceleration: {
                mean: Number(this.mean(accelerations).toFixed(2)),
                std: Number(this.std(accelerations).toFixed(2))
            },
            path: {
                totalDistance: Number(totalDistance.toFixed(2)),
                directDistance: Number(directDistance.toFixed(2)),
                directnessRatio: Number(directnessRatio.toFixed(3))
            },
            curvature: {
                mean: Number(meanCurvature.toFixed(4)),
                total: Number(curvatures.reduce((a,b) => a+b, 0).toFixed(3))
            },
            smoothness: Number(smoothness.toFixed(3)),
            hesitations: {
                count: hesitations,
                ratio: Number(hesitationRatio.toFixed(3))
            },
            pressure: {
                mean: Number(meanPressure.toFixed(3)),
                variability: Number(pressureVariability.toFixed(3))
            },
            pointCount: points.length,
            duration: Number((tNorm[tNorm.length-1]).toFixed(2))
        };
    }

    detectAnomalies(features) {
        const anomalies = [];

        // Bot-like detection: too smooth or too consistent
        if (features.velocity.cv < 0.05 && features.smoothness > 0.95) {
            anomalies.push({
                type: 'bot_suspected',
                severity: 'high',
                message: 'Movement pattern too consistent - possible automation',
                confidence: 0.85
            });
        }

        // Robotic movement: perfect straight lines
        if (features.path.directnessRatio > 0.98 && features.curvature.mean < 0.01) {
            anomalies.push({
                type: 'robotic_movement',
                severity: 'medium',
                message: 'Unnaturally straight movement detected',
                confidence: 0.75
            });
        }

        // Velocity spike (possible teleportation/automation)
        if (features.velocity.max > features.velocity.mean * 10 && features.velocity.max > 5000) {
            anomalies.push({
                type: 'velocity_spike',
                severity: 'medium',
                message: 'Abnormal velocity spike detected',
                confidence: 0.70
            });
        }

        // Too many hesitations (possible distress or fraud)
        if (features.hesitations.ratio > 0.4) {
            anomalies.push({
                type: 'excessive_hesitation',
                severity: 'low',
                message: 'High hesitation frequency detected',
                confidence: 0.60
            });
        }

        // Zero or near-zero smoothness (jittery, possibly fake)
        if (features.smoothness < 0.1) {
            anomalies.push({
                type: 'jittery_movement',
                severity: 'medium',
                message: 'Erratic movement pattern detected',
                confidence: 0.65
            });
        }

        return anomalies;
    }

    calculateScore(features) {
        let score = 70; // Base score

        // Reward natural variability
        if (features.velocity.cv > 0.15 && features.velocity.cv < 0.8) score += 10;

        // Reward natural smoothness
        if (features.smoothness > 0.5 && features.smoothness < 0.95) score += 10;

        // Reward natural directness (not too straight, not too curvy)
        if (features.path.directnessRatio > 0.4 && features.path.directnessRatio < 0.9) score += 5;

        // Penalize excessive hesitation
        if (features.hesitations.ratio > 0.3) score -= 10;

        // Penalize too perfect movement
        if (features.velocity.cv < 0.05) score -= 15;

        // Penalize very erratic movement
        if (features.smoothness < 0.2) score -= 10;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    emptyFeatures() {
        return {
            velocity: { mean: 0, std: 0, max: 0, min: 0, cv: 0 },
            acceleration: { mean: 0, std: 0 },
            path: { totalDistance: 0, directDistance: 0, directnessRatio: 0 },
            curvature: { mean: 0, total: 0 },
            smoothness: 0,
            hesitations: { count: 0, ratio: 0 },
            pressure: { mean: 0, variability: 0 },
            pointCount: 0,
            duration: 0
        };
    }

    mean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    std(arr) {
        if (!arr || arr.length < 2) return 0;
        const m = this.mean(arr);
        return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);
    }
}

// ==================== KEYSTROKE ANALYZER ====================

class KeystrokeAnalyzer {
    extractFeatures(keystrokes) {
        if (!keystrokes || keystrokes.length < 3) {
            return this.emptyFeatures();
        }

        // Hold durations (key down to key up)
        const holdDurations = keystrokes
            .filter(k => k.releaseTime && k.pressTime)
            .map(k => k.releaseTime - k.pressTime);

        // Flight times (time between releasing one key and pressing next)
        const flightTimes = [];
        for (let i = 1; i < keystrokes.length; i++) {
            const flight = keystrokes[i].pressTime - (keystrokes[i-1].releaseTime || keystrokes[i-1].pressTime);
            if (flight >= 0 && flight < 2000) flightTimes.push(flight);
        }

        // Digraph timings (key-to-key times)
        const digraphTimes = [];
        for (let i = 1; i < keystrokes.length; i++) {
            const digraph = keystrokes[i].pressTime - keystrokes[i-1].pressTime;
            if (digraph > 0 && digraph < 2000) digraphTimes.push(digraph);
        }

        // Calculate typing speed (characters per minute)
        const totalTime = keystrokes.length > 1 ?
            (keystrokes[keystrokes.length-1].pressTime - keystrokes[0].pressTime) / 1000 / 60 : 0;
        const typingSpeed = totalTime > 0 ? keystrokes.length / totalTime : 0;

        // Rhythm analysis
        const rhythmDeviations = [];
        if (digraphTimes.length > 1) {
            const meanDigraph = this.mean(digraphTimes);
            for (const dt of digraphTimes) {
                rhythmDeviations.push(Math.abs(dt - meanDigraph) / Math.max(meanDigraph, 1));
            }
        }
        const rhythmScore = rhythmDeviations.length > 0 ?
            Math.max(0, 1 - this.mean(rhythmDeviations)) : 0.5;

        return {
            holdDuration: {
                mean: Number(this.mean(holdDurations).toFixed(2)),
                std: Number(this.std(holdDurations).toFixed(2)),
                min: holdDurations.length > 0 ? Number(Math.min(...holdDurations).toFixed(2)) : 0,
                max: holdDurations.length > 0 ? Number(Math.max(...holdDurations).toFixed(2)) : 0
            },
            flightTime: {
                mean: Number(this.mean(flightTimes).toFixed(2)),
                std: Number(this.std(flightTimes).toFixed(2))
            },
            digraph: {
                mean: Number(this.mean(digraphTimes).toFixed(2)),
                std: Number(this.std(digraphTimes).toFixed(2))
            },
            typingSpeed: Number(typingSpeed.toFixed(1)),
            rhythmScore: Number(rhythmScore.toFixed(3)),
            keyCount: keystrokes.length
        };
    }

    detectAnomalies(features) {
        const anomalies = [];

        // Robotic typing (too consistent)
        if (features.holdDuration.std < 5 && features.holdDuration.mean > 0) {
            anomalies.push({
                type: 'robotic_typing',
                severity: 'high',
                message: 'Keystroke timing too consistent - possible automation',
                confidence: 0.85
            });
        }

        // Inhuman speed
        if (features.typingSpeed > 800) {
            anomalies.push({
                type: 'inhuman_speed',
                severity: 'high',
                message: 'Typing speed exceeds human capability',
                confidence: 0.95
            });
        }

        // Very slow, hesitant typing (possibly under duress)
        if (features.typingSpeed < 20 && features.typingSpeed > 0 && features.flightTime.mean > 500) {
            anomalies.push({
                type: 'hesitant_typing',
                severity: 'low',
                message: 'Unusually slow and hesitant typing pattern',
                confidence: 0.55
            });
        }

        return anomalies;
    }

    calculateScore(features) {
        let score = 70;

        // Reward natural variability in hold duration
        if (features.holdDuration.std > 10 && features.holdDuration.std < 100) score += 10;

        // Reward natural typing speed range
        if (features.typingSpeed > 30 && features.typingSpeed < 400) score += 10;

        // Reward good rhythm
        if (features.rhythmScore > 0.6) score += 10;

        // Penalize too consistent (robotic)
        if (features.holdDuration.std < 5 && features.holdDuration.mean > 0) score -= 20;

        // Penalize inhuman speed
        if (features.typingSpeed > 600) score -= 30;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    emptyFeatures() {
        return {
            holdDuration: { mean: 0, std: 0, min: 0, max: 0 },
            flightTime: { mean: 0, std: 0 },
            digraph: { mean: 0, std: 0 },
            typingSpeed: 0,
            rhythmScore: 0.5,
            keyCount: 0
        };
    }

    mean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    std(arr) {
        if (!arr || arr.length < 2) return 0;
        const m = this.mean(arr);
        return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length);
    }
}

// ==================== COGNITIVE ANALYZER ====================

class CognitiveAnalyzer {
    analyze(cursorFeatures, keystrokeFeatures, sessionInfo = {}) {
        // Task complexity estimation
        const taskComplexity = this.estimateTaskComplexity(cursorFeatures, keystrokeFeatures);

        // Fatigue detection
        const fatigue = this.detectFatigue(cursorFeatures, keystrokeFeatures);

        // Attention level
        const attention = this.estimateAttention(cursorFeatures);

        // Stress indicator
        const stress = this.estimateStress(cursorFeatures, keystrokeFeatures);

        // Cognitive load
        const cognitiveLoad = (taskComplexity + fatigue + stress) / 3;

        return {
            taskComplexity: Number(taskComplexity.toFixed(2)),
            fatigue: Number(fatigue.toFixed(2)),
            attention: Number(attention.toFixed(2)),
            stress: Number(stress.toFixed(2)),
            cognitiveLoad: Number(cognitiveLoad.toFixed(2)),
            state: this.determineState(attention, fatigue, stress)
        };
    }

    estimateTaskComplexity(cursorFeatures, keystrokeFeatures) {
        let complexity = 0.3; // Base complexity

        // More hesitations = more complex task
        if (cursorFeatures.hesitations) {
            complexity += cursorFeatures.hesitations.ratio * 0.3;
        }

        // Lower directness = searching/exploring = complex
        if (cursorFeatures.path) {
            complexity += (1 - cursorFeatures.path.directnessRatio) * 0.2;
        }

        // Variable typing speed = thinking while typing = complex
        if (keystrokeFeatures.digraph && keystrokeFeatures.digraph.std > 100) {
            complexity += 0.2;
        }

        return Math.min(1, complexity);
    }

    detectFatigue(cursorFeatures, keystrokeFeatures) {
        let fatigue = 0.2; // Base fatigue

        // Decreasing velocity suggests fatigue
        if (cursorFeatures.velocity && cursorFeatures.velocity.mean < 100) {
            fatigue += 0.2;
        }

        // Low smoothness = possibly tired, imprecise
        if (cursorFeatures.smoothness && cursorFeatures.smoothness < 0.4) {
            fatigue += 0.2;
        }

        // Slower typing suggests fatigue
        if (keystrokeFeatures.typingSpeed && keystrokeFeatures.typingSpeed < 30) {
            fatigue += 0.2;
        }

        // More hesitations might indicate tiredness
        if (cursorFeatures.hesitations && cursorFeatures.hesitations.ratio > 0.3) {
            fatigue += 0.2;
        }

        return Math.min(1, fatigue);
    }

    estimateAttention(cursorFeatures) {
        let attention = 0.7; // Base attention

        // High directness = focused
        if (cursorFeatures.path && cursorFeatures.path.directnessRatio > 0.7) {
            attention += 0.15;
        }

        // Few hesitations = focused
        if (cursorFeatures.hesitations && cursorFeatures.hesitations.ratio < 0.1) {
            attention += 0.1;
        }

        // Good smoothness = deliberate, focused
        if (cursorFeatures.smoothness && cursorFeatures.smoothness > 0.6) {
            attention += 0.1;
        }

        // Many hesitations = distracted
        if (cursorFeatures.hesitations && cursorFeatures.hesitations.ratio > 0.3) {
            attention -= 0.2;
        }

        return Math.max(0, Math.min(1, attention));
    }

    estimateStress(cursorFeatures, keystrokeFeatures) {
        let stress = 0.2; // Base stress

        // High velocity variability might indicate stress
        if (cursorFeatures.velocity && cursorFeatures.velocity.cv > 0.6) {
            stress += 0.2;
        }

        // Jerky movements = stress
        if (cursorFeatures.smoothness && cursorFeatures.smoothness < 0.3) {
            stress += 0.2;
        }

        // Irregular typing rhythm = stress
        if (keystrokeFeatures.rhythmScore && keystrokeFeatures.rhythmScore < 0.4) {
            stress += 0.2;
        }

        // High pressure variability (if available)
        if (cursorFeatures.pressure && cursorFeatures.pressure.variability > 0.3) {
            stress += 0.2;
        }

        return Math.min(1, stress);
    }

    determineState(attention, fatigue, stress) {
        if (attention > 0.7 && fatigue < 0.4 && stress < 0.4) return 'focused';
        if (fatigue > 0.6) return 'fatigued';
        if (stress > 0.6) return 'stressed';
        if (attention < 0.4) return 'distracted';
        return 'normal';
    }
}

// ==================== MAIN ENGINE ====================

class BehaviorAnalyticsEngine {
    constructor() {
        this.cursorAnalyzer = new CursorAnalyzer();
        this.keystrokeAnalyzer = new KeystrokeAnalyzer();
        this.cognitiveAnalyzer = new CognitiveAnalyzer();
    }

    analyze(data) {
        const { cursor_points = [], keystrokes = [], session_info = {}, user_id = 'anonymous' } = data;

        // Extract features
        const cursorFeatures = this.cursorAnalyzer.extractFeatures(cursor_points);
        const keystrokeFeatures = this.keystrokeAnalyzer.extractFeatures(keystrokes);

        // Detect anomalies
        const cursorAnomalies = this.cursorAnalyzer.detectAnomalies(cursorFeatures);
        const keystrokeAnomalies = this.keystrokeAnalyzer.detectAnomalies(keystrokeFeatures);
        const allAnomalies = [...cursorAnomalies, ...keystrokeAnomalies];

        // Calculate scores
        const cursorScore = this.cursorAnalyzer.calculateScore(cursorFeatures);
        const keystrokeScore = keystrokes.length > 0 ?
            this.keystrokeAnalyzer.calculateScore(keystrokeFeatures) : 70;

        // Cognitive analysis
        const cognitive = this.cognitiveAnalyzer.analyze(cursorFeatures, keystrokeFeatures, session_info);

        // Combined BBA score
        const hasKeystrokes = keystrokes.length > 2;
        const bbaScore = hasKeystrokes ?
            Math.round(cursorScore * 0.5 + keystrokeScore * 0.5) :
            cursorScore;

        // Risk assessment
        const riskLevel = this.assessRisk(bbaScore, allAnomalies);

        // Check against user baseline if exists
        const baseline = userBaselines.get(user_id);
        let baselineDeviation = null;
        if (baseline) {
            baselineDeviation = this.calculateBaselineDeviation(cursorFeatures, keystrokeFeatures, baseline);
        }

        return {
            timestamp: new Date().toISOString(),
            user_id,
            bba: {
                overall_score: bbaScore,
                cursor_score: cursorScore,
                keystroke_score: keystrokeScore,
                confidence: this.calculateConfidence(cursor_points.length, keystrokes.length)
            },
            cursor_metrics: cursorFeatures,
            keystroke_metrics: keystrokeFeatures,
            cognitive,
            anomalies: allAnomalies,
            risk_assessment: riskLevel,
            baseline_comparison: baselineDeviation,
            recommendations: this.generateRecommendations(bbaScore, allAnomalies, riskLevel)
        };
    }

    assessRisk(score, anomalies) {
        const highSeverityCount = anomalies.filter(a => a.severity === 'high').length;
        const mediumSeverityCount = anomalies.filter(a => a.severity === 'medium').length;

        let riskScore = 100 - score;
        riskScore += highSeverityCount * 20;
        riskScore += mediumSeverityCount * 10;
        riskScore = Math.min(100, riskScore);

        let level = 'LOW';
        if (riskScore >= 70) level = 'CRITICAL';
        else if (riskScore >= 50) level = 'HIGH';
        else if (riskScore >= 30) level = 'MEDIUM';

        return {
            score: riskScore,
            level,
            factors: anomalies.map(a => a.type)
        };
    }

    calculateConfidence(cursorPoints, keystrokeCount) {
        let confidence = 0.5;

        if (cursorPoints > 50) confidence += 0.2;
        else if (cursorPoints > 20) confidence += 0.1;

        if (keystrokeCount > 10) confidence += 0.2;
        else if (keystrokeCount > 5) confidence += 0.1;

        return Math.min(0.95, confidence);
    }

    calculateBaselineDeviation(cursorFeatures, keystrokeFeatures, baseline) {
        let totalDeviation = 0;
        let count = 0;

        if (baseline.cursor && cursorFeatures.velocity) {
            const velDev = Math.abs(cursorFeatures.velocity.mean - baseline.cursor.velocity_mean) /
                Math.max(baseline.cursor.velocity_mean, 1);
            totalDeviation += velDev;
            count++;
        }

        if (baseline.keystroke && keystrokeFeatures.typingSpeed) {
            const speedDev = Math.abs(keystrokeFeatures.typingSpeed - baseline.keystroke.typing_speed) /
                Math.max(baseline.keystroke.typing_speed, 1);
            totalDeviation += speedDev;
            count++;
        }

        const avgDeviation = count > 0 ? totalDeviation / count : 0;

        return {
            deviation_score: Number(avgDeviation.toFixed(3)),
            is_significant: avgDeviation > 0.5,
            message: avgDeviation > 0.5 ?
                'Behavior significantly differs from baseline' :
                'Behavior matches baseline profile'
        };
    }

    generateRecommendations(score, anomalies, risk) {
        const recommendations = [];

        if (risk.level === 'CRITICAL') {
            recommendations.push('🚨 Recommend blocking transaction and requiring re-authentication');
        } else if (risk.level === 'HIGH') {
            recommendations.push('⚠️ Recommend additional verification (OTP/Biometric)');
        }

        if (anomalies.some(a => a.type === 'bot_suspected')) {
            recommendations.push('🤖 Bot/Automation suspected - implement CAPTCHA challenge');
        }

        if (anomalies.some(a => a.type === 'excessive_hesitation')) {
            recommendations.push('💭 User appears uncertain - consider offering help');
        }

        if (score > 80 && anomalies.length === 0) {
            recommendations.push('✅ Behavior appears authentic - safe to proceed');
        }

        return recommendations;
    }

    updateBaseline(userId, data) {
        const { cursor_points = [], keystrokes = [] } = data;

        const cursorFeatures = this.cursorAnalyzer.extractFeatures(cursor_points);
        const keystrokeFeatures = this.keystrokeAnalyzer.extractFeatures(keystrokes);

        const existingBaseline = userBaselines.get(userId) || {
            sample_count: 0,
            cursor: {},
            keystroke: {}
        };

        const sampleCount = existingBaseline.sample_count + 1;
        const weight = 1 / sampleCount;

        const newBaseline = {
            sample_count: sampleCount,
            cursor: {
                velocity_mean: this.weightedAverage(
                    existingBaseline.cursor.velocity_mean || 0,
                    cursorFeatures.velocity.mean,
                    weight
                ),
                smoothness: this.weightedAverage(
                    existingBaseline.cursor.smoothness || 0,
                    cursorFeatures.smoothness,
                    weight
                ),
                directness: this.weightedAverage(
                    existingBaseline.cursor.directness || 0,
                    cursorFeatures.path.directnessRatio,
                    weight
                )
            },
            keystroke: {
                typing_speed: this.weightedAverage(
                    existingBaseline.keystroke.typing_speed || 0,
                    keystrokeFeatures.typingSpeed,
                    weight
                ),
                rhythm_score: this.weightedAverage(
                    existingBaseline.keystroke.rhythm_score || 0,
                    keystrokeFeatures.rhythmScore,
                    weight
                )
            },
            last_updated: new Date().toISOString()
        };

        userBaselines.set(userId, newBaseline);
        return newBaseline;
    }

    weightedAverage(oldVal, newVal, weight) {
        return Number(((1 - weight) * oldVal + weight * newVal).toFixed(4));
    }
}

// ==================== API ENDPOINTS ====================

const engine = new BehaviorAnalyticsEngine();

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'KAVACH Behavior Analytics API',
        version: '1.0.0',
        endpoints: {
            analyze: 'POST /analyze - Full behavior analysis',
            baseline: 'POST /baseline - Update user baseline',
            health: 'GET /health - Health check'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: (Date.now() - START_TIME) / 1000,
        version: '1.0.0'
    });
});

// Main analysis endpoint
app.post('/analyze', (req, res) => {
    try {
        const data = {
            user_id: req.body.user_id || 'anonymous',
            cursor_points: req.body.cursor_points || [],
            keystrokes: req.body.keystrokes || [],
            session_info: req.body.session_info || {}
        };

        const result = engine.analyze(data);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update baseline endpoint
app.post('/baseline', (req, res) => {
    try {
        const { user_id, cursor_points = [], keystrokes = [] } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: 'user_id is required'
            });
        }

        const baseline = engine.updateBaseline(user_id, { cursor_points, keystrokes });

        res.json({
            success: true,
            message: `Baseline updated for user ${user_id}`,
            sample_count: baseline.sample_count
        });
    } catch (error) {
        console.error('Baseline error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get baseline endpoint
app.get('/baseline/:userId', (req, res) => {
    const baseline = userBaselines.get(req.params.userId);

    if (!baseline) {
        return res.json({
            success: false,
            message: `No baseline found for user ${req.params.userId}`,
            data: null
        });
    }

    res.json({
        success: true,
        data: {
            user_id: req.params.userId,
            ...baseline
        }
    });
});

// Cursor-only analysis
app.post('/analyze/cursor', (req, res) => {
    try {
        const points = req.body;
        const features = engine.cursorAnalyzer.extractFeatures(points);
        const anomalies = engine.cursorAnalyzer.detectAnomalies(features);
        const score = engine.cursorAnalyzer.calculateScore(features);

        res.json({
            success: true,
            data: { features, anomalies, score }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Keystroke-only analysis
app.post('/analyze/keystrokes', (req, res) => {
    try {
        const keystrokes = req.body;
        const features = engine.keystrokeAnalyzer.extractFeatures(keystrokes);
        const anomalies = engine.keystrokeAnalyzer.detectAnomalies(features);
        const score = engine.keystrokeAnalyzer.calculateScore(features);

        res.json({
            success: true,
            data: { features, anomalies, score }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(55));
    console.log('  KAVACH Behavior Analytics API (Node.js)');
    console.log('='.repeat(55));
    console.log(`\n  Server running on http://localhost:${PORT}`);
    console.log('\n  Endpoints:');
    console.log('    GET  /               - API info');
    console.log('    GET  /health         - Health check');
    console.log('    POST /analyze        - Full behavior analysis');
    console.log('    POST /baseline       - Update user baseline');
    console.log('    GET  /baseline/:id   - Get user baseline');
    console.log('    POST /analyze/cursor     - Cursor analysis only');
    console.log('    POST /analyze/keystrokes - Keystroke analysis only');
    console.log('\n' + '='.repeat(55));
});
