"""
Real-time Behavior Analytics Engine
Analyzes cursor movements, keystroke dynamics, and cognitive patterns
Uses ML models for anomaly detection and user verification
"""

import numpy as np
from scipy import stats
from scipy.signal import savgol_filter
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
import json
import time
from datetime import datetime
from collections import deque
import warnings
warnings.filterwarnings('ignore')


class CursorAnalyzer:
    """
    Analyzes cursor/touch movement patterns for behavioral biometrics
    """

    def __init__(self):
        self.scaler = StandardScaler()
        self.isolation_forest = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42
        )
        self.baseline_features = None
        self.is_trained = False

    def extract_features(self, points):
        """
        Extract features from cursor movement points
        points: list of {x, y, timestamp} dicts
        """
        if len(points) < 5:
            return self._empty_features()

        # Convert to numpy arrays
        x = np.array([p['x'] for p in points])
        y = np.array([p['y'] for p in points])
        t = np.array([p['timestamp'] for p in points])

        # Normalize timestamps
        t = (t - t[0]) / 1000  # Convert to seconds from start

        # Calculate velocities
        dx = np.diff(x)
        dy = np.diff(y)
        dt = np.diff(t)
        dt[dt == 0] = 0.001  # Avoid division by zero

        distances = np.sqrt(dx**2 + dy**2)
        velocities = distances / dt

        # Calculate accelerations
        dv = np.diff(velocities) if len(velocities) > 1 else np.array([0])
        dt2 = dt[:-1] if len(dt) > 1 else np.array([0.001])
        dt2[dt2 == 0] = 0.001
        accelerations = dv / dt2 if len(dv) > 0 else np.array([0])

        # Calculate angles
        angles = np.arctan2(dy, dx)
        angle_changes = np.abs(np.diff(angles)) if len(angles) > 1 else np.array([0])

        # Calculate curvature
        curvature = self._calculate_curvature(x, y)

        # Calculate jerk (rate of change of acceleration)
        jerk = np.diff(accelerations) / dt2[:-1] if len(accelerations) > 1 and len(dt2) > 1 else np.array([0])

        # Directness ratio (straight line distance / actual path length)
        straight_distance = np.sqrt((x[-1] - x[0])**2 + (y[-1] - y[0])**2)
        path_length = np.sum(distances)
        directness = straight_distance / path_length if path_length > 0 else 1.0

        # Smoothness score (based on jitter)
        velocity_variance = np.var(velocities) if len(velocities) > 0 else 0
        smoothness = max(0, 100 - min(100, np.sqrt(velocity_variance) / 5))

        # Hesitations (low velocity periods)
        hesitations = np.sum(velocities < 50) if len(velocities) > 0 else 0

        # Overshoots (sudden direction changes with high velocity)
        overshoots = np.sum((angle_changes > np.pi/2) & (velocities[:-1] > 500)) if len(angle_changes) > 0 else 0

        features = {
            # Velocity features
            'velocity_mean': float(np.mean(velocities)) if len(velocities) > 0 else 0,
            'velocity_std': float(np.std(velocities)) if len(velocities) > 0 else 0,
            'velocity_max': float(np.max(velocities)) if len(velocities) > 0 else 0,
            'velocity_min': float(np.min(velocities)) if len(velocities) > 0 else 0,
            'velocity_median': float(np.median(velocities)) if len(velocities) > 0 else 0,

            # Acceleration features
            'acceleration_mean': float(np.mean(accelerations)) if len(accelerations) > 0 else 0,
            'acceleration_std': float(np.std(accelerations)) if len(accelerations) > 0 else 0,
            'acceleration_max': float(np.max(np.abs(accelerations))) if len(accelerations) > 0 else 0,

            # Jerk features
            'jerk_mean': float(np.mean(np.abs(jerk))) if len(jerk) > 0 else 0,
            'jerk_std': float(np.std(jerk)) if len(jerk) > 0 else 0,

            # Angular features
            'angle_change_mean': float(np.mean(angle_changes)) if len(angle_changes) > 0 else 0,
            'angle_change_std': float(np.std(angle_changes)) if len(angle_changes) > 0 else 0,

            # Curvature features
            'curvature_mean': float(np.mean(np.abs(curvature))) if len(curvature) > 0 else 0,
            'curvature_std': float(np.std(curvature)) if len(curvature) > 0 else 0,

            # Path features
            'total_distance': float(np.sum(distances)),
            'directness_ratio': float(directness),
            'path_efficiency': float(min(1.0, directness)),

            # Movement quality
            'smoothness_score': float(smoothness),
            'hesitation_count': int(hesitations),
            'overshoot_count': int(overshoots),

            # Duration
            'total_duration': float(t[-1] - t[0]) if len(t) > 1 else 0,
            'points_count': len(points),
            'points_per_second': len(points) / max(0.001, t[-1] - t[0]) if len(t) > 1 else 0,
        }

        return features

    def _calculate_curvature(self, x, y):
        """Calculate curvature of the path"""
        if len(x) < 3:
            return np.array([0])

        dx = np.gradient(x)
        dy = np.gradient(y)
        ddx = np.gradient(dx)
        ddy = np.gradient(dy)

        denominator = (dx**2 + dy**2)**1.5
        denominator[denominator == 0] = 0.001

        curvature = np.abs(dx * ddy - dy * ddx) / denominator
        return curvature

    def _empty_features(self):
        """Return empty features dict"""
        return {
            'velocity_mean': 0, 'velocity_std': 0, 'velocity_max': 0,
            'velocity_min': 0, 'velocity_median': 0,
            'acceleration_mean': 0, 'acceleration_std': 0, 'acceleration_max': 0,
            'jerk_mean': 0, 'jerk_std': 0,
            'angle_change_mean': 0, 'angle_change_std': 0,
            'curvature_mean': 0, 'curvature_std': 0,
            'total_distance': 0, 'directness_ratio': 1, 'path_efficiency': 1,
            'smoothness_score': 100, 'hesitation_count': 0, 'overshoot_count': 0,
            'total_duration': 0, 'points_count': 0, 'points_per_second': 0
        }

    def detect_anomalies(self, features):
        """
        Detect anomalies in cursor movement
        """
        anomalies = []

        # Bot detection: very high points per second (>100)
        if features['points_per_second'] > 100:
            anomalies.append({
                'type': 'bot_like_speed',
                'severity': 'high',
                'description': f"Abnormally high event rate: {features['points_per_second']:.0f}/s",
                'confidence': 0.9
            })

        # Velocity anomaly
        if features['velocity_max'] > 5000:
            anomalies.append({
                'type': 'velocity_spike',
                'severity': 'high',
                'description': f"Extreme velocity detected: {features['velocity_max']:.0f} px/s",
                'confidence': 0.85
            })

        # Teleportation (very high velocity with low point count)
        if features['velocity_max'] > 3000 and features['points_count'] < 10:
            anomalies.append({
                'type': 'teleportation',
                'severity': 'high',
                'description': "Cursor teleportation detected",
                'confidence': 0.9
            })

        # Robotic movement (very low variance in velocity)
        if features['velocity_std'] < 10 and features['points_count'] > 20:
            anomalies.append({
                'type': 'robotic_movement',
                'severity': 'medium',
                'description': "Unnaturally consistent movement speed",
                'confidence': 0.75
            })

        # Too smooth (suspiciously perfect movement)
        if features['smoothness_score'] > 99 and features['points_count'] > 50:
            anomalies.append({
                'type': 'synthetic_movement',
                'severity': 'medium',
                'description': "Movement too smooth for human input",
                'confidence': 0.7
            })

        # Excessive hesitations (possible uncertainty/unfamiliarity)
        if features['hesitation_count'] > features['points_count'] * 0.3:
            anomalies.append({
                'type': 'excessive_hesitation',
                'severity': 'low',
                'description': f"High hesitation rate: {features['hesitation_count']} pauses",
                'confidence': 0.6
            })

        return anomalies

    def calculate_score(self, features, baseline=None):
        """
        Calculate BBA cursor score (0-100)
        Higher score = more human-like, matches baseline
        """
        score = 100

        # Penalize bot-like behavior
        if features['points_per_second'] > 100:
            score -= 40
        elif features['points_per_second'] > 60:
            score -= 20

        # Penalize extreme velocities
        if features['velocity_max'] > 5000:
            score -= 30
        elif features['velocity_max'] > 3000:
            score -= 15

        # Penalize robotic movement
        if features['velocity_std'] < 10 and features['points_count'] > 20:
            score -= 25

        # Penalize too-perfect smoothness
        if features['smoothness_score'] > 99 and features['points_count'] > 50:
            score -= 20

        # Compare with baseline if available
        if baseline:
            velocity_diff = abs(features['velocity_mean'] - baseline.get('velocity_mean', features['velocity_mean']))
            if baseline.get('velocity_mean', 0) > 0:
                velocity_ratio = velocity_diff / baseline['velocity_mean']
                if velocity_ratio > 0.5:
                    score -= min(30, velocity_ratio * 30)

        return max(0, min(100, score))


class KeystrokeAnalyzer:
    """
    Analyzes keystroke dynamics for behavioral biometrics
    """

    def __init__(self):
        self.baseline = None

    def extract_features(self, keystrokes):
        """
        Extract features from keystroke events
        keystrokes: list of {key, pressTime, releaseTime} dicts
        """
        if len(keystrokes) < 3:
            return self._empty_features()

        # Calculate hold durations (dwell times)
        hold_durations = []
        for ks in keystrokes:
            if 'releaseTime' in ks and 'pressTime' in ks:
                hold = ks['releaseTime'] - ks['pressTime']
                if 0 < hold < 2000:  # Filter unrealistic values
                    hold_durations.append(hold)

        # Calculate flight times (key-to-key latency)
        flight_times = []
        for i in range(1, len(keystrokes)):
            if 'pressTime' in keystrokes[i] and 'releaseTime' in keystrokes[i-1]:
                flight = keystrokes[i]['pressTime'] - keystrokes[i-1]['releaseTime']
                if -500 < flight < 2000:  # Allow negative for overlapping keys
                    flight_times.append(flight)

        # Calculate digraph timings (consecutive key pairs)
        digraph_times = []
        for i in range(1, len(keystrokes)):
            if 'pressTime' in keystrokes[i] and 'pressTime' in keystrokes[i-1]:
                digraph = keystrokes[i]['pressTime'] - keystrokes[i-1]['pressTime']
                if 0 < digraph < 2000:
                    digraph_times.append(digraph)

        # Calculate typing speed
        if len(keystrokes) >= 2:
            total_time = (keystrokes[-1].get('releaseTime', keystrokes[-1].get('pressTime', 0)) -
                         keystrokes[0].get('pressTime', 0)) / 60000  # minutes
            typing_speed = len(keystrokes) / max(0.001, total_time)  # CPM
        else:
            typing_speed = 0

        # Calculate rhythm consistency
        if len(digraph_times) > 2:
            rhythm_variance = np.var(digraph_times)
            rhythm_score = max(0, 100 - np.sqrt(rhythm_variance) / 2)
        else:
            rhythm_score = 50

        features = {
            # Hold duration features
            'hold_mean': float(np.mean(hold_durations)) if hold_durations else 0,
            'hold_std': float(np.std(hold_durations)) if hold_durations else 0,
            'hold_min': float(np.min(hold_durations)) if hold_durations else 0,
            'hold_max': float(np.max(hold_durations)) if hold_durations else 0,

            # Flight time features
            'flight_mean': float(np.mean(flight_times)) if flight_times else 0,
            'flight_std': float(np.std(flight_times)) if flight_times else 0,
            'flight_min': float(np.min(flight_times)) if flight_times else 0,
            'flight_max': float(np.max(flight_times)) if flight_times else 0,

            # Digraph features
            'digraph_mean': float(np.mean(digraph_times)) if digraph_times else 0,
            'digraph_std': float(np.std(digraph_times)) if digraph_times else 0,

            # Overall metrics
            'typing_speed_cpm': float(typing_speed),
            'rhythm_score': float(rhythm_score),
            'total_keystrokes': len(keystrokes),
            'error_rate': 0,  # Would need backspace detection
        }

        return features

    def _empty_features(self):
        return {
            'hold_mean': 0, 'hold_std': 0, 'hold_min': 0, 'hold_max': 0,
            'flight_mean': 0, 'flight_std': 0, 'flight_min': 0, 'flight_max': 0,
            'digraph_mean': 0, 'digraph_std': 0,
            'typing_speed_cpm': 0, 'rhythm_score': 50, 'total_keystrokes': 0, 'error_rate': 0
        }

    def detect_anomalies(self, features):
        """Detect anomalies in keystroke patterns"""
        anomalies = []

        # Inhuman typing speed (>600 CPM is very fast)
        if features['typing_speed_cpm'] > 800:
            anomalies.append({
                'type': 'superhuman_typing',
                'severity': 'high',
                'description': f"Typing speed {features['typing_speed_cpm']:.0f} CPM exceeds human capability",
                'confidence': 0.9
            })

        # Too consistent hold times (bot-like)
        if features['hold_std'] < 5 and features['total_keystrokes'] > 10:
            anomalies.append({
                'type': 'robotic_typing',
                'severity': 'high',
                'description': "Unnaturally consistent key hold times",
                'confidence': 0.85
            })

        # Too fast key transitions
        if features['flight_min'] < 10 and features['total_keystrokes'] > 5:
            anomalies.append({
                'type': 'instant_key_transition',
                'severity': 'medium',
                'description': "Key transitions faster than human capability",
                'confidence': 0.8
            })

        return anomalies

    def calculate_score(self, features, baseline=None):
        """Calculate BBA keystroke score (0-100)"""
        score = 100

        # Penalize superhuman speed
        if features['typing_speed_cpm'] > 800:
            score -= 40
        elif features['typing_speed_cpm'] > 600:
            score -= 20

        # Penalize robotic consistency
        if features['hold_std'] < 5 and features['total_keystrokes'] > 10:
            score -= 30

        # Penalize instant transitions
        if features['flight_min'] < 10:
            score -= 25

        # Reward good rhythm
        score += (features['rhythm_score'] - 50) * 0.2

        # Compare with baseline
        if baseline and baseline.get('hold_mean', 0) > 0:
            hold_diff = abs(features['hold_mean'] - baseline['hold_mean'])
            hold_ratio = hold_diff / baseline['hold_mean']
            if hold_ratio > 0.5:
                score -= min(25, hold_ratio * 25)

        return max(0, min(100, score))


class CognitiveAnalyzer:
    """
    Analyzes cognitive patterns from user interaction
    """

    def __init__(self):
        self.session_start = time.time()
        self.decision_points = []
        self.navigation_history = []

    def analyze(self, session_data):
        """
        Analyze cognitive patterns from session data
        """
        duration = time.time() - self.session_start

        # Calculate cognitive load indicators
        task_complexity = self._calculate_task_complexity(session_data)
        user_fatigue = self._calculate_fatigue(duration, session_data)
        attention_level = self._calculate_attention(session_data)
        stress_indicator = self._calculate_stress(session_data)

        # Detect anomalies
        anomalies = self._detect_cognitive_anomalies(session_data)

        # Calculate risk score
        risk_score = self._calculate_risk(anomalies, session_data)

        return {
            'cognitive_load': {
                'task_complexity': task_complexity,
                'user_fatigue': user_fatigue,
                'attention_level': attention_level,
                'stress_indicator': stress_indicator
            },
            'anomalies': anomalies,
            'risk_score': risk_score,
            'recommendation': self._get_recommendation(risk_score, anomalies)
        }

    def _calculate_task_complexity(self, data):
        """Calculate task complexity (0-100)"""
        points = data.get('cursor_points', 0)
        keystrokes = data.get('keystroke_count', 0)
        gestures = data.get('gesture_count', 0)

        complexity = min(100, (points + keystrokes * 2 + gestures * 5) / 5)
        return complexity

    def _calculate_fatigue(self, duration, data):
        """Calculate user fatigue (0-100)"""
        # Fatigue increases with time
        time_fatigue = min(50, duration / 120 * 50)  # Max 50% from time (2 min)

        # Fatigue increases with error/hesitation
        hesitations = data.get('hesitation_count', 0)
        hesitation_fatigue = min(50, hesitations * 5)

        return min(100, time_fatigue + hesitation_fatigue)

    def _calculate_attention(self, data):
        """Calculate attention level (0-100)"""
        # Start at 100, decrease with inactivity
        idle_time = data.get('idle_time', 0)
        attention = max(0, 100 - idle_time / 1000 * 10)  # -10% per second idle

        return attention

    def _calculate_stress(self, data):
        """Calculate stress indicator (0-100)"""
        anomaly_count = len(data.get('anomalies', []))
        velocity_variance = data.get('velocity_variance', 0)
        hesitations = data.get('hesitation_count', 0)

        stress = min(100, anomaly_count * 15 + np.sqrt(velocity_variance) / 10 + hesitations * 3)
        return stress

    def _detect_cognitive_anomalies(self, data):
        """Detect cognitive/behavioral anomalies"""
        anomalies = []

        # Rushing detection
        if data.get('decision_time', 1000) < 200:
            anomalies.append({
                'type': 'rushing',
                'severity': 'medium',
                'description': 'Decisions made too quickly (possible automation)',
                'confidence': 0.7
            })

        # Automation pattern
        if data.get('action_interval_variance', 100) < 10:
            anomalies.append({
                'type': 'automation',
                'severity': 'high',
                'description': 'Unnaturally consistent action timing',
                'confidence': 0.85
            })

        # Coercion indicators (high stress + slow + corrections)
        stress = self._calculate_stress(data)
        if stress > 70 and data.get('correction_count', 0) > 3:
            anomalies.append({
                'type': 'possible_coercion',
                'severity': 'high',
                'description': 'Behavior patterns suggest possible coercion',
                'confidence': 0.6
            })

        # Unfamiliarity (many navigation backtracks)
        if data.get('backtrack_count', 0) > 3:
            anomalies.append({
                'type': 'unfamiliarity',
                'severity': 'low',
                'description': 'User appears unfamiliar with interface',
                'confidence': 0.65
            })

        return anomalies

    def _calculate_risk(self, anomalies, data):
        """Calculate overall risk score (0-100)"""
        base_risk = 0

        for anomaly in anomalies:
            if anomaly['severity'] == 'high':
                base_risk += 30 * anomaly['confidence']
            elif anomaly['severity'] == 'medium':
                base_risk += 15 * anomaly['confidence']
            else:
                base_risk += 5 * anomaly['confidence']

        return min(100, base_risk)

    def _get_recommendation(self, risk_score, anomalies):
        """Get action recommendation based on risk"""
        if risk_score >= 75:
            return 'BLOCK'
        elif risk_score >= 50:
            return 'REAUTH_REQUIRED'
        elif risk_score >= 25:
            return 'PROCEED_WITH_CAUTION'
        else:
            return 'PROCEED'


class BehaviorAnalyticsEngine:
    """
    Main engine combining all analyzers
    """

    def __init__(self):
        self.cursor_analyzer = CursorAnalyzer()
        self.keystroke_analyzer = KeystrokeAnalyzer()
        self.cognitive_analyzer = CognitiveAnalyzer()
        self.user_baselines = {}

    def analyze(self, data):
        """
        Perform complete behavior analysis

        data: {
            'user_id': str,
            'cursor_points': list of {x, y, timestamp},
            'keystrokes': list of {key, pressTime, releaseTime},
            'session_info': dict with additional context
        }
        """
        user_id = data.get('user_id', 'anonymous')

        # Extract features
        cursor_features = self.cursor_analyzer.extract_features(
            data.get('cursor_points', [])
        )
        keystroke_features = self.keystroke_analyzer.extract_features(
            data.get('keystrokes', [])
        )

        # Detect anomalies
        cursor_anomalies = self.cursor_analyzer.detect_anomalies(cursor_features)
        keystroke_anomalies = self.keystroke_analyzer.detect_anomalies(keystroke_features)

        # Get user baseline if exists
        baseline = self.user_baselines.get(user_id, {})

        # Calculate BBA scores
        cursor_score = self.cursor_analyzer.calculate_score(
            cursor_features, baseline.get('cursor')
        )
        keystroke_score = self.keystroke_analyzer.calculate_score(
            keystroke_features, baseline.get('keystroke')
        )

        # Combined BBA score (weighted)
        bba_score = (cursor_score * 0.5 + keystroke_score * 0.5)

        # Cognitive analysis
        cognitive_data = {
            'cursor_points': len(data.get('cursor_points', [])),
            'keystroke_count': len(data.get('keystrokes', [])),
            'hesitation_count': cursor_features['hesitation_count'],
            'velocity_variance': cursor_features['velocity_std'] ** 2,
            'anomalies': cursor_anomalies + keystroke_anomalies,
            **data.get('session_info', {})
        }
        cognitive_result = self.cognitive_analyzer.analyze(cognitive_data)

        # Calculate overall risk
        all_anomalies = cursor_anomalies + keystroke_anomalies + cognitive_result['anomalies']
        risk_score = self._calculate_overall_risk(bba_score, all_anomalies)

        # Determine risk level
        risk_level = self._get_risk_level(risk_score)

        result = {
            'timestamp': datetime.now().isoformat(),
            'user_id': user_id,
            'bba': {
                'overall_score': round(bba_score, 1),
                'cursor_score': round(cursor_score, 1),
                'keystroke_score': round(keystroke_score, 1),
                'touch_score': round((cursor_score + keystroke_score) / 2, 1),  # Combined
                'is_match': bba_score >= 60
            },
            'cursor_metrics': cursor_features,
            'keystroke_metrics': keystroke_features,
            'cognitive': cognitive_result,
            'anomalies': all_anomalies,
            'risk': {
                'score': round(risk_score, 1),
                'level': risk_level,
                'factors': [a['type'] for a in all_anomalies]
            },
            'recommendation': self._get_recommendation(risk_score, all_anomalies),
            'data_points': len(data.get('cursor_points', [])) + len(data.get('keystrokes', []))
        }

        return result

    def update_baseline(self, user_id, data):
        """Update user's behavioral baseline"""
        cursor_features = self.cursor_analyzer.extract_features(
            data.get('cursor_points', [])
        )
        keystroke_features = self.keystroke_analyzer.extract_features(
            data.get('keystrokes', [])
        )

        if user_id not in self.user_baselines:
            self.user_baselines[user_id] = {
                'cursor': cursor_features,
                'keystroke': keystroke_features,
                'sample_count': 1
            }
        else:
            # Weighted average with existing baseline
            baseline = self.user_baselines[user_id]
            weight = baseline['sample_count'] / (baseline['sample_count'] + 1)

            for key in cursor_features:
                if isinstance(cursor_features[key], (int, float)):
                    baseline['cursor'][key] = (
                        baseline['cursor'].get(key, 0) * weight +
                        cursor_features[key] * (1 - weight)
                    )

            for key in keystroke_features:
                if isinstance(keystroke_features[key], (int, float)):
                    baseline['keystroke'][key] = (
                        baseline['keystroke'].get(key, 0) * weight +
                        keystroke_features[key] * (1 - weight)
                    )

            baseline['sample_count'] += 1

        return self.user_baselines[user_id]

    def _calculate_overall_risk(self, bba_score, anomalies):
        """Calculate overall risk score"""
        # Base risk from BBA mismatch
        bba_risk = max(0, 100 - bba_score)

        # Risk from anomalies
        anomaly_risk = 0
        for anomaly in anomalies:
            if anomaly['severity'] == 'high':
                anomaly_risk += 25 * anomaly['confidence']
            elif anomaly['severity'] == 'medium':
                anomaly_risk += 12 * anomaly['confidence']
            else:
                anomaly_risk += 5 * anomaly['confidence']

        # Combined risk (weighted)
        risk = bba_risk * 0.4 + anomaly_risk * 0.6

        return min(100, risk)

    def _get_risk_level(self, score):
        """Convert risk score to level"""
        if score >= 75:
            return 'CRITICAL'
        elif score >= 50:
            return 'HIGH'
        elif score >= 25:
            return 'MEDIUM'
        else:
            return 'LOW'

    def _get_recommendation(self, risk_score, anomalies):
        """Get action recommendation"""
        high_severity = any(a['severity'] == 'high' for a in anomalies)

        if risk_score >= 75 or (high_severity and risk_score >= 50):
            return {
                'action': 'BLOCK',
                'message': 'Critical behavioral mismatch. Block transaction and verify identity.',
                'require_reauth': True
            }
        elif risk_score >= 50:
            return {
                'action': 'REAUTH',
                'message': 'Significant anomalies detected. Additional verification required.',
                'require_reauth': True
            }
        elif risk_score >= 25:
            return {
                'action': 'CAUTION',
                'message': 'Minor deviations observed. Monitor for high-value transactions.',
                'require_reauth': False
            }
        else:
            return {
                'action': 'PROCEED',
                'message': 'Behavioral patterns match profile. Transaction approved.',
                'require_reauth': False
            }


# Singleton instance
behavior_engine = BehaviorAnalyticsEngine()


def analyze_behavior(data):
    """Main entry point for behavior analysis"""
    return behavior_engine.analyze(data)


def update_user_baseline(user_id, data):
    """Update user's behavioral baseline"""
    return behavior_engine.update_baseline(user_id, data)


# For testing
if __name__ == '__main__':
    # Test with sample data
    test_data = {
        'user_id': 'test_user',
        'cursor_points': [
            {'x': 100, 'y': 100, 'timestamp': 1000},
            {'x': 150, 'y': 120, 'timestamp': 1050},
            {'x': 200, 'y': 150, 'timestamp': 1100},
            {'x': 250, 'y': 180, 'timestamp': 1150},
            {'x': 300, 'y': 200, 'timestamp': 1200},
        ],
        'keystrokes': [
            {'key': 'h', 'pressTime': 1000, 'releaseTime': 1100},
            {'key': 'e', 'pressTime': 1200, 'releaseTime': 1280},
            {'key': 'l', 'pressTime': 1350, 'releaseTime': 1420},
            {'key': 'l', 'pressTime': 1500, 'releaseTime': 1580},
            {'key': 'o', 'pressTime': 1650, 'releaseTime': 1720},
        ],
        'session_info': {}
    }

    result = analyze_behavior(test_data)
    print(json.dumps(result, indent=2))
