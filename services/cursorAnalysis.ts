/**
 * Cursor Analysis Service
 * Tracks touch/cursor movements, gestures, and interaction patterns
 * for behavioral biometric analysis and fraud detection
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Touch point data structure
export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;
  size?: number;
}

// Gesture data structure
export interface GestureData {
  type: 'tap' | 'double_tap' | 'long_press' | 'swipe' | 'pinch' | 'scroll';
  startPoint: TouchPoint;
  endPoint?: TouchPoint;
  duration: number;
  velocity?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}

// Cursor movement metrics
export interface CursorMetrics {
  totalDistance: number;
  averageVelocity: number;
  maxVelocity: number;
  minVelocity: number;
  accelerationChanges: number;
  smoothnessScore: number; // 0-100
  directnessRatio: number; // straight line distance / actual distance
  dwellTimes: DwellTime[];
  hesitations: number;
  overshoots: number;
}

// Dwell time on specific UI elements
export interface DwellTime {
  elementId: string;
  elementType: string;
  duration: number;
  timestamp: number;
}

// Touch pressure profile
export interface PressureProfile {
  averagePressure: number;
  maxPressure: number;
  minPressure: number;
  pressureVariance: number;
  pressurePattern: number[];
}

// Complete cursor session data
export interface CursorSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  touchPoints: TouchPoint[];
  gestures: GestureData[];
  metrics: CursorMetrics;
  pressureProfile?: PressureProfile;
  screenContext: string;
  interactionCount: number;
}

// Anomaly detection result
export interface CursorAnomaly {
  type: 'velocity' | 'pattern' | 'pressure' | 'timing' | 'trajectory';
  severity: 'low' | 'medium' | 'high';
  description: string;
  confidence: number;
  timestamp: number;
}

class CursorAnalysisService {
  private currentSession: CursorSession | null = null;
  private touchHistory: TouchPoint[] = [];
  private gestureHistory: GestureData[] = [];
  private baselineProfile: CursorMetrics | null = null;
  private anomalies: CursorAnomaly[] = [];
  private lastTouchTime: number = 0;
  private tapCount: number = 0;
  private tapTimer: NodeJS.Timeout | null = null;

  // Thresholds for analysis
  private readonly VELOCITY_THRESHOLD = 2000; // pixels per second
  private readonly HESITATION_THRESHOLD = 300; // ms
  private readonly DOUBLE_TAP_THRESHOLD = 300; // ms
  private readonly LONG_PRESS_THRESHOLD = 500; // ms
  private readonly SMOOTHNESS_WINDOW = 5; // points for smoothness calculation

  /**
   * Start a new cursor tracking session
   */
  startSession(screenContext: string): string {
    const sessionId = `CURSOR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      touchPoints: [],
      gestures: [],
      metrics: this.createEmptyMetrics(),
      screenContext,
      interactionCount: 0
    };

    this.touchHistory = [];
    this.gestureHistory = [];
    this.anomalies = [];

    console.log(`[CursorAnalysis] Session started: ${sessionId} on ${screenContext}`);
    return sessionId;
  }

  /**
   * End current session and return analysis
   */
  endSession(): CursorSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = Date.now();
    this.currentSession.metrics = this.calculateMetrics();
    this.currentSession.touchPoints = [...this.touchHistory];
    this.currentSession.gestures = [...this.gestureHistory];

    const session = { ...this.currentSession };

    console.log(`[CursorAnalysis] Session ended: ${session.sessionId}`);
    console.log(`[CursorAnalysis] Metrics:`, JSON.stringify(session.metrics, null, 2));

    this.currentSession = null;
    return session;
  }

  /**
   * Record a touch point
   */
  recordTouch(x: number, y: number, pressure?: number, size?: number): void {
    if (!this.currentSession) return;

    const touchPoint: TouchPoint = {
      x,
      y,
      timestamp: Date.now(),
      pressure,
      size
    };

    this.touchHistory.push(touchPoint);
    this.currentSession.interactionCount++;

    // Check for tap gestures
    this.detectTapGesture(touchPoint);

    // Detect anomalies in real-time
    this.detectRealTimeAnomalies(touchPoint);
  }

  /**
   * Record touch start event
   */
  recordTouchStart(x: number, y: number, pressure?: number): void {
    this.lastTouchTime = Date.now();
    this.recordTouch(x, y, pressure);
  }

  /**
   * Record touch move event
   */
  recordTouchMove(x: number, y: number, pressure?: number): void {
    this.recordTouch(x, y, pressure);
  }

  /**
   * Record touch end event
   */
  recordTouchEnd(x: number, y: number): void {
    if (!this.currentSession) return;

    const duration = Date.now() - this.lastTouchTime;
    const startPoint = this.touchHistory[this.touchHistory.length - 1];

    if (!startPoint) return;

    // Detect gesture type based on movement and duration
    if (duration > this.LONG_PRESS_THRESHOLD && this.getMovementDistance(startPoint, { x, y, timestamp: Date.now() }) < 20) {
      this.recordGesture('long_press', startPoint, { x, y, timestamp: Date.now() }, duration);
    } else if (this.getMovementDistance(startPoint, { x, y, timestamp: Date.now() }) > 50) {
      this.recordSwipeGesture(startPoint, { x, y, timestamp: Date.now() }, duration);
    }
  }

  /**
   * Record a gesture
   */
  recordGesture(
    type: GestureData['type'],
    startPoint: TouchPoint,
    endPoint?: TouchPoint,
    duration?: number
  ): void {
    if (!this.currentSession) return;

    const gesture: GestureData = {
      type,
      startPoint,
      endPoint,
      duration: duration || (endPoint ? endPoint.timestamp - startPoint.timestamp : 0),
      velocity: endPoint ? this.calculateVelocity(startPoint, endPoint) : 0,
      direction: endPoint ? this.getSwipeDirection(startPoint, endPoint) : undefined,
      distance: endPoint ? this.getMovementDistance(startPoint, endPoint) : 0
    };

    this.gestureHistory.push(gesture);
    console.log(`[CursorAnalysis] Gesture recorded: ${type}`);
  }

  /**
   * Record dwell time on a UI element
   */
  recordDwellTime(elementId: string, elementType: string, duration: number): void {
    if (!this.currentSession) return;

    const dwellTime: DwellTime = {
      elementId,
      elementType,
      duration,
      timestamp: Date.now()
    };

    this.currentSession.metrics.dwellTimes.push(dwellTime);
  }

  /**
   * Detect tap gestures (single/double tap)
   */
  private detectTapGesture(touchPoint: TouchPoint): void {
    this.tapCount++;

    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
    }

    this.tapTimer = setTimeout(() => {
      if (this.tapCount === 1) {
        this.recordGesture('tap', touchPoint);
      } else if (this.tapCount >= 2) {
        this.recordGesture('double_tap', touchPoint);
      }
      this.tapCount = 0;
    }, this.DOUBLE_TAP_THRESHOLD);
  }

  /**
   * Record swipe gesture with direction
   */
  private recordSwipeGesture(startPoint: TouchPoint, endPoint: TouchPoint, duration: number): void {
    const gesture: GestureData = {
      type: 'swipe',
      startPoint,
      endPoint,
      duration,
      velocity: this.calculateVelocity(startPoint, endPoint),
      direction: this.getSwipeDirection(startPoint, endPoint),
      distance: this.getMovementDistance(startPoint, endPoint)
    };

    this.gestureHistory.push(gesture);
  }

  /**
   * Calculate velocity between two points
   */
  private calculateVelocity(start: TouchPoint, end: TouchPoint): number {
    const distance = this.getMovementDistance(start, end);
    const time = (end.timestamp - start.timestamp) / 1000; // Convert to seconds
    return time > 0 ? distance / time : 0;
  }

  /**
   * Get movement distance between two points
   */
  private getMovementDistance(start: TouchPoint, end: TouchPoint): number {
    return Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
  }

  /**
   * Get swipe direction
   */
  private getSwipeDirection(start: TouchPoint, end: TouchPoint): 'up' | 'down' | 'left' | 'right' {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }

  /**
   * Calculate comprehensive cursor metrics
   */
  private calculateMetrics(): CursorMetrics {
    if (this.touchHistory.length < 2) {
      return this.createEmptyMetrics();
    }

    let totalDistance = 0;
    const velocities: number[] = [];
    let accelerationChanges = 0;
    let hesitations = 0;
    let overshoots = 0;
    let lastVelocity = 0;

    // Calculate metrics from touch history
    for (let i = 1; i < this.touchHistory.length; i++) {
      const prev = this.touchHistory[i - 1];
      const curr = this.touchHistory[i];

      const distance = this.getMovementDistance(prev, curr);
      totalDistance += distance;

      const velocity = this.calculateVelocity(prev, curr);
      velocities.push(velocity);

      // Detect acceleration changes
      if (i > 1 && Math.abs(velocity - lastVelocity) > 500) {
        accelerationChanges++;
      }

      // Detect hesitations (sudden stops)
      const timeDiff = curr.timestamp - prev.timestamp;
      if (timeDiff > this.HESITATION_THRESHOLD && distance < 10) {
        hesitations++;
      }

      lastVelocity = velocity;
    }

    // Calculate directness ratio
    const firstPoint = this.touchHistory[0];
    const lastPoint = this.touchHistory[this.touchHistory.length - 1];
    const straightLineDistance = this.getMovementDistance(firstPoint, lastPoint);
    const directnessRatio = totalDistance > 0 ? straightLineDistance / totalDistance : 1;

    // Calculate smoothness score
    const smoothnessScore = this.calculateSmoothnessScore();

    return {
      totalDistance,
      averageVelocity: velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0,
      maxVelocity: velocities.length > 0 ? Math.max(...velocities) : 0,
      minVelocity: velocities.length > 0 ? Math.min(...velocities) : 0,
      accelerationChanges,
      smoothnessScore,
      directnessRatio,
      dwellTimes: this.currentSession?.metrics.dwellTimes || [],
      hesitations,
      overshoots
    };
  }

  /**
   * Calculate smoothness score (0-100)
   * Based on consistency of movement and lack of jitter
   */
  private calculateSmoothnessScore(): number {
    if (this.touchHistory.length < this.SMOOTHNESS_WINDOW) {
      return 100; // Not enough data, assume smooth
    }

    let jitterScore = 0;
    let angleChanges = 0;

    for (let i = 2; i < this.touchHistory.length; i++) {
      const p1 = this.touchHistory[i - 2];
      const p2 = this.touchHistory[i - 1];
      const p3 = this.touchHistory[i];

      // Calculate angle change
      const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      const angleDiff = Math.abs(angle2 - angle1);

      if (angleDiff > 0.5) { // Significant direction change
        angleChanges++;
      }

      // Calculate jitter (small back-and-forth movements)
      const d1 = this.getMovementDistance(p1, p2);
      const d2 = this.getMovementDistance(p2, p3);
      if (d1 < 5 && d2 < 5 && angleDiff > Math.PI / 2) {
        jitterScore++;
      }
    }

    const maxAngleChanges = this.touchHistory.length - 2;
    const smoothness = 100 - ((angleChanges / maxAngleChanges) * 50) - (jitterScore * 5);

    return Math.max(0, Math.min(100, smoothness));
  }

  /**
   * Calculate pressure profile
   */
  calculatePressureProfile(): PressureProfile | null {
    const pressures = this.touchHistory
      .filter(t => t.pressure !== undefined)
      .map(t => t.pressure!);

    if (pressures.length === 0) return null;

    const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    const variance = pressures.reduce((sum, p) => sum + Math.pow(p - avgPressure, 2), 0) / pressures.length;

    return {
      averagePressure: avgPressure,
      maxPressure: Math.max(...pressures),
      minPressure: Math.min(...pressures),
      pressureVariance: variance,
      pressurePattern: pressures.slice(0, 20) // First 20 pressure points as pattern
    };
  }

  /**
   * Detect real-time anomalies
   */
  private detectRealTimeAnomalies(touchPoint: TouchPoint): void {
    if (this.touchHistory.length < 3) return;

    const prevPoint = this.touchHistory[this.touchHistory.length - 2];
    const velocity = this.calculateVelocity(prevPoint, touchPoint);

    // Check for abnormal velocity
    if (velocity > this.VELOCITY_THRESHOLD) {
      this.anomalies.push({
        type: 'velocity',
        severity: velocity > this.VELOCITY_THRESHOLD * 2 ? 'high' : 'medium',
        description: `Abnormal cursor velocity: ${velocity.toFixed(0)} px/s`,
        confidence: 0.8,
        timestamp: Date.now()
      });
    }

    // Check for teleportation (cursor jumping)
    const distance = this.getMovementDistance(prevPoint, touchPoint);
    const timeDiff = touchPoint.timestamp - prevPoint.timestamp;
    if (distance > 200 && timeDiff < 50) {
      this.anomalies.push({
        type: 'trajectory',
        severity: 'high',
        description: 'Cursor teleportation detected',
        confidence: 0.9,
        timestamp: Date.now()
      });
    }

    // Compare with baseline if available
    if (this.baselineProfile) {
      this.compareWithBaseline(velocity);
    }
  }

  /**
   * Compare current behavior with baseline profile
   */
  private compareWithBaseline(currentVelocity: number): void {
    if (!this.baselineProfile) return;

    const velocityDeviation = Math.abs(currentVelocity - this.baselineProfile.averageVelocity) / this.baselineProfile.averageVelocity;

    if (velocityDeviation > 0.5) { // 50% deviation from baseline
      this.anomalies.push({
        type: 'pattern',
        severity: velocityDeviation > 1 ? 'high' : 'medium',
        description: `Velocity deviation from baseline: ${(velocityDeviation * 100).toFixed(0)}%`,
        confidence: 0.7,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Set baseline profile for comparison
   */
  setBaselineProfile(profile: CursorMetrics): void {
    this.baselineProfile = profile;
    console.log('[CursorAnalysis] Baseline profile set');
  }

  /**
   * Get detected anomalies
   */
  getAnomalies(): CursorAnomaly[] {
    return [...this.anomalies];
  }

  /**
   * Get anomaly risk score (0-100)
   */
  getAnomalyRiskScore(): number {
    if (this.anomalies.length === 0) return 0;

    let score = 0;
    for (const anomaly of this.anomalies) {
      switch (anomaly.severity) {
        case 'high':
          score += 30 * anomaly.confidence;
          break;
        case 'medium':
          score += 15 * anomaly.confidence;
          break;
        case 'low':
          score += 5 * anomaly.confidence;
          break;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): CursorMetrics {
    return {
      totalDistance: 0,
      averageVelocity: 0,
      maxVelocity: 0,
      minVelocity: 0,
      accelerationChanges: 0,
      smoothnessScore: 100,
      directnessRatio: 1,
      dwellTimes: [],
      hesitations: 0,
      overshoots: 0
    };
  }

  /**
   * Get current session data
   */
  getCurrentSession(): CursorSession | null {
    return this.currentSession;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Get touch history
   */
  getTouchHistory(): TouchPoint[] {
    return [...this.touchHistory];
  }

  /**
   * Get gesture history
   */
  getGestureHistory(): GestureData[] {
    return [...this.gestureHistory];
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.currentSession = null;
    this.touchHistory = [];
    this.gestureHistory = [];
    this.anomalies = [];
    this.baselineProfile = null;
  }
}

// Export singleton instance
export const cursorAnalysis = new CursorAnalysisService();
export { CursorAnalysisService };
