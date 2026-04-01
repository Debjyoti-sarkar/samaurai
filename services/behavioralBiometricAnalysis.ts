/**
 * Behavioral Biometric Analysis (BBA) Service
 * Analyzes keystroke dynamics, touch patterns, and gesture behaviors
 * to create unique user biometric profiles for fraud detection
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { cursorAnalysis, CursorMetrics, CursorSession, TouchPoint } from './cursorAnalysis';

// Keystroke timing data
export interface KeystrokeEvent {
  key: string;
  keyCode?: number;
  pressTime: number;
  releaseTime: number;
  holdDuration: number;
  position?: { x: number; y: number };
}

// Digraph (two consecutive keys) timing
export interface DigraphTiming {
  keys: string;
  latency: number; // Time between first key release and second key press
  flightTime: number; // Time between first key press and second key press
}

// Keystroke dynamics profile
export interface KeystrokeDynamics {
  averageHoldDuration: number;
  holdDurationVariance: number;
  averageLatency: number;
  latencyVariance: number;
  typingSpeed: number; // Characters per minute
  errorRate: number;
  rhythmPattern: number[];
  digraphTimings: Map<string, number[]>;
}

// Touch behavior profile
export interface TouchBehaviorProfile {
  averagePressure: number;
  pressureConsistency: number;
  averageTouchSize: number;
  touchSizeConsistency: number;
  preferredTouchZones: TouchZone[];
  swipeCharacteristics: SwipeCharacteristics;
}

// Touch zone analysis
export interface TouchZone {
  zone: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  frequency: number;
  averagePressure: number;
}

// Swipe characteristics
export interface SwipeCharacteristics {
  averageVelocity: number;
  velocityConsistency: number;
  preferredDirection: 'horizontal' | 'vertical' | 'mixed';
  averageLength: number;
  curvature: number; // 0 = straight, 1 = very curved
}

// Complete biometric profile
export interface BiometricProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;
  sampleCount: number;
  keystrokeDynamics: KeystrokeDynamics;
  touchBehavior: TouchBehaviorProfile;
  cursorMetrics: CursorMetrics;
  confidenceScore: number; // 0-100, how reliable the profile is
}

// BBA comparison result
export interface BBAComparisonResult {
  isMatch: boolean;
  overallScore: number; // 0-100, 100 = perfect match
  keystrokeScore: number;
  touchScore: number;
  cursorScore: number;
  anomalies: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

// Risk thresholds
const RISK_THRESHOLDS = {
  low: 80,
  medium: 60,
  high: 40,
  critical: 20
};

const STORAGE_KEY = '@kavach_biometric_profile';
const MIN_SAMPLES_FOR_PROFILE = 5;

class BehavioralBiometricAnalysisService {
  private userProfile: BiometricProfile | null = null;
  private currentKeystrokeEvents: KeystrokeEvent[] = [];
  private currentTouchEvents: TouchPoint[] = [];
  private sessionSamples: BiometricProfile[] = [];
  private isCollectingBaseline: boolean = false;

  constructor() {
    this.loadProfile();
  }

  /**
   * Load user profile from storage
   */
  private async loadProfile(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.userProfile = JSON.parse(stored);
        console.log('[BBA] Profile loaded for user:', this.userProfile?.userId);
      }
    } catch (error) {
      console.error('[BBA] Failed to load profile:', error);
    }
  }

  /**
   * Save user profile to storage
   */
  private async saveProfile(): Promise<void> {
    if (!this.userProfile) return;

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.userProfile));
      console.log('[BBA] Profile saved');
    } catch (error) {
      console.error('[BBA] Failed to save profile:', error);
    }
  }

  /**
   * Start collecting baseline data for a new user
   */
  startBaselineCollection(userId: string): void {
    this.isCollectingBaseline = true;
    this.sessionSamples = [];
    this.userProfile = {
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sampleCount: 0,
      keystrokeDynamics: this.createEmptyKeystrokeDynamics(),
      touchBehavior: this.createEmptyTouchBehavior(),
      cursorMetrics: this.createEmptyCursorMetrics(),
      confidenceScore: 0
    };
    console.log('[BBA] Started baseline collection for user:', userId);
  }

  /**
   * Record a keystroke event
   */
  recordKeystroke(key: string, pressTime: number, releaseTime: number, position?: { x: number; y: number }): void {
    const event: KeystrokeEvent = {
      key,
      pressTime,
      releaseTime,
      holdDuration: releaseTime - pressTime,
      position
    };

    this.currentKeystrokeEvents.push(event);
  }

  /**
   * Record key press (call on keydown)
   */
  recordKeyPress(key: string, position?: { x: number; y: number }): void {
    const event: KeystrokeEvent = {
      key,
      pressTime: Date.now(),
      releaseTime: 0,
      holdDuration: 0,
      position
    };
    this.currentKeystrokeEvents.push(event);
  }

  /**
   * Record key release (call on keyup)
   */
  recordKeyRelease(key: string): void {
    const lastEvent = this.currentKeystrokeEvents
      .filter(e => e.key === key && e.releaseTime === 0)
      .pop();

    if (lastEvent) {
      lastEvent.releaseTime = Date.now();
      lastEvent.holdDuration = lastEvent.releaseTime - lastEvent.pressTime;
    }
  }

  /**
   * Analyze keystroke dynamics from current events
   */
  analyzeKeystrokeDynamics(): KeystrokeDynamics {
    const events = this.currentKeystrokeEvents.filter(e => e.holdDuration > 0);

    if (events.length < 2) {
      return this.createEmptyKeystrokeDynamics();
    }

    // Calculate hold durations
    const holdDurations = events.map(e => e.holdDuration);
    const avgHold = holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length;
    const holdVariance = holdDurations.reduce((sum, d) => sum + Math.pow(d - avgHold, 2), 0) / holdDurations.length;

    // Calculate latencies (time between consecutive keys)
    const latencies: number[] = [];
    const digraphTimings = new Map<string, number[]>();

    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];
      const latency = curr.pressTime - prev.releaseTime;
      latencies.push(latency);

      // Record digraph timing
      const digraph = `${prev.key}${curr.key}`;
      if (!digraphTimings.has(digraph)) {
        digraphTimings.set(digraph, []);
      }
      digraphTimings.get(digraph)!.push(latency);
    }

    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const latencyVariance = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + Math.pow(l - avgLatency, 2), 0) / latencies.length
      : 0;

    // Calculate typing speed
    const totalTime = events[events.length - 1].releaseTime - events[0].pressTime;
    const typingSpeed = totalTime > 0 ? (events.length / totalTime) * 60000 : 0; // CPM

    // Calculate rhythm pattern (normalized hold durations)
    const maxHold = Math.max(...holdDurations);
    const rhythmPattern = holdDurations.slice(0, 20).map(d => d / maxHold);

    return {
      averageHoldDuration: avgHold,
      holdDurationVariance: holdVariance,
      averageLatency: avgLatency,
      latencyVariance: latencyVariance,
      typingSpeed,
      errorRate: 0, // TODO: Track backspace/corrections
      rhythmPattern,
      digraphTimings
    };
  }

  /**
   * Analyze touch behavior from cursor session
   */
  analyzeTouchBehavior(session: CursorSession): TouchBehaviorProfile {
    const touchPoints = session.touchPoints;
    const gestures = session.gestures;

    // Analyze pressure
    const pressures = touchPoints.filter(t => t.pressure !== undefined).map(t => t.pressure!);
    const avgPressure = pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0.5;
    const pressureVariance = pressures.length > 0
      ? pressures.reduce((sum, p) => sum + Math.pow(p - avgPressure, 2), 0) / pressures.length
      : 0;

    // Analyze touch size
    const sizes = touchPoints.filter(t => t.size !== undefined).map(t => t.size!);
    const avgSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 20;
    const sizeVariance = sizes.length > 0
      ? sizes.reduce((sum, s) => sum + Math.pow(s - avgSize, 2), 0) / sizes.length
      : 0;

    // Analyze touch zones
    const touchZones = this.analyzeTouchZones(touchPoints);

    // Analyze swipe characteristics
    const swipes = gestures.filter(g => g.type === 'swipe');
    const swipeCharacteristics = this.analyzeSwipeCharacteristics(swipes);

    return {
      averagePressure: avgPressure,
      pressureConsistency: 1 - Math.min(1, Math.sqrt(pressureVariance)),
      averageTouchSize: avgSize,
      touchSizeConsistency: 1 - Math.min(1, Math.sqrt(sizeVariance) / avgSize),
      preferredTouchZones: touchZones,
      swipeCharacteristics
    };
  }

  /**
   * Analyze touch zones distribution
   */
  private analyzeTouchZones(touchPoints: TouchPoint[]): TouchZone[] {
    const zones: Map<string, { count: number; pressures: number[] }> = new Map();
    const screenWidth = 400; // Approximate
    const screenHeight = 800; // Approximate

    for (const point of touchPoints) {
      const zoneX = point.x < screenWidth / 3 ? 'left' : point.x < (screenWidth * 2) / 3 ? 'center' : 'right';
      const zoneY = point.y < screenHeight / 3 ? 'top' : point.y < (screenHeight * 2) / 3 ? 'middle' : 'bottom';
      const zone = `${zoneY}-${zoneX}` as TouchZone['zone'];

      if (!zones.has(zone)) {
        zones.set(zone, { count: 0, pressures: [] });
      }
      const zoneData = zones.get(zone)!;
      zoneData.count++;
      if (point.pressure !== undefined) {
        zoneData.pressures.push(point.pressure);
      }
    }

    const result: TouchZone[] = [];
    zones.forEach((data, zone) => {
      result.push({
        zone: zone as TouchZone['zone'],
        frequency: data.count / touchPoints.length,
        averagePressure: data.pressures.length > 0
          ? data.pressures.reduce((a, b) => a + b, 0) / data.pressures.length
          : 0.5
      });
    });

    return result.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Analyze swipe characteristics
   */
  private analyzeSwipeCharacteristics(swipes: any[]): SwipeCharacteristics {
    if (swipes.length === 0) {
      return {
        averageVelocity: 0,
        velocityConsistency: 1,
        preferredDirection: 'mixed',
        averageLength: 0,
        curvature: 0
      };
    }

    const velocities = swipes.map(s => s.velocity || 0);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const velocityVariance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVelocity, 2), 0) / velocities.length;

    const lengths = swipes.map(s => s.distance || 0);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    // Determine preferred direction
    const horizontalSwipes = swipes.filter(s => s.direction === 'left' || s.direction === 'right').length;
    const verticalSwipes = swipes.filter(s => s.direction === 'up' || s.direction === 'down').length;
    const preferredDirection = horizontalSwipes > verticalSwipes * 1.5 ? 'horizontal'
      : verticalSwipes > horizontalSwipes * 1.5 ? 'vertical'
      : 'mixed';

    return {
      averageVelocity: avgVelocity,
      velocityConsistency: avgVelocity > 0 ? 1 - Math.min(1, Math.sqrt(velocityVariance) / avgVelocity) : 1,
      preferredDirection,
      averageLength: avgLength,
      curvature: 0 // TODO: Calculate from touch path
    };
  }

  /**
   * Add sample to profile (for baseline building)
   */
  addSampleToProfile(session: CursorSession): void {
    if (!this.userProfile) return;

    const keystrokeDynamics = this.analyzeKeystrokeDynamics();
    const touchBehavior = this.analyzeTouchBehavior(session);

    // Merge with existing profile using weighted average
    const sampleCount = this.userProfile.sampleCount;
    const weight = sampleCount / (sampleCount + 1);
    const newWeight = 1 / (sampleCount + 1);

    // Update keystroke dynamics
    this.userProfile.keystrokeDynamics.averageHoldDuration =
      this.userProfile.keystrokeDynamics.averageHoldDuration * weight + keystrokeDynamics.averageHoldDuration * newWeight;
    this.userProfile.keystrokeDynamics.averageLatency =
      this.userProfile.keystrokeDynamics.averageLatency * weight + keystrokeDynamics.averageLatency * newWeight;
    this.userProfile.keystrokeDynamics.typingSpeed =
      this.userProfile.keystrokeDynamics.typingSpeed * weight + keystrokeDynamics.typingSpeed * newWeight;

    // Update touch behavior
    this.userProfile.touchBehavior.averagePressure =
      this.userProfile.touchBehavior.averagePressure * weight + touchBehavior.averagePressure * newWeight;

    // Update cursor metrics
    this.userProfile.cursorMetrics.averageVelocity =
      this.userProfile.cursorMetrics.averageVelocity * weight + session.metrics.averageVelocity * newWeight;
    this.userProfile.cursorMetrics.smoothnessScore =
      this.userProfile.cursorMetrics.smoothnessScore * weight + session.metrics.smoothnessScore * newWeight;

    this.userProfile.sampleCount++;
    this.userProfile.updatedAt = Date.now();
    this.userProfile.confidenceScore = Math.min(100, (this.userProfile.sampleCount / MIN_SAMPLES_FOR_PROFILE) * 100);

    this.saveProfile();
    this.clearCurrentEvents();

    console.log(`[BBA] Sample added. Total samples: ${this.userProfile.sampleCount}, Confidence: ${this.userProfile.confidenceScore}%`);
  }

  /**
   * Compare current behavior with stored profile
   */
  compareWithProfile(session: CursorSession): BBAComparisonResult {
    if (!this.userProfile || this.userProfile.confidenceScore < 50) {
      return {
        isMatch: true,
        overallScore: 100,
        keystrokeScore: 100,
        touchScore: 100,
        cursorScore: 100,
        anomalies: [],
        riskLevel: 'low',
        recommendation: 'Insufficient profile data for comparison'
      };
    }

    const keystrokeDynamics = this.analyzeKeystrokeDynamics();
    const touchBehavior = this.analyzeTouchBehavior(session);
    const anomalies: string[] = [];

    // Compare keystroke dynamics
    const keystrokeScore = this.compareKeystrokeDynamics(keystrokeDynamics, anomalies);

    // Compare touch behavior
    const touchScore = this.compareTouchBehavior(touchBehavior, anomalies);

    // Compare cursor metrics
    const cursorScore = this.compareCursorMetrics(session.metrics, anomalies);

    // Calculate overall score
    const overallScore = (keystrokeScore * 0.4) + (touchScore * 0.3) + (cursorScore * 0.3);

    // Determine risk level
    let riskLevel: BBAComparisonResult['riskLevel'];
    if (overallScore >= RISK_THRESHOLDS.low) riskLevel = 'low';
    else if (overallScore >= RISK_THRESHOLDS.medium) riskLevel = 'medium';
    else if (overallScore >= RISK_THRESHOLDS.high) riskLevel = 'high';
    else riskLevel = 'critical';

    // Generate recommendation
    const recommendation = this.generateRecommendation(riskLevel, anomalies);

    const result: BBAComparisonResult = {
      isMatch: overallScore >= RISK_THRESHOLDS.medium,
      overallScore,
      keystrokeScore,
      touchScore,
      cursorScore,
      anomalies,
      riskLevel,
      recommendation
    };

    console.log('[BBA] Comparison result:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Compare keystroke dynamics
   */
  private compareKeystrokeDynamics(current: KeystrokeDynamics, anomalies: string[]): number {
    const profile = this.userProfile!.keystrokeDynamics;
    let score = 100;

    // Compare hold duration
    const holdDeviation = Math.abs(current.averageHoldDuration - profile.averageHoldDuration) / profile.averageHoldDuration;
    if (holdDeviation > 0.5) {
      score -= 30;
      anomalies.push(`Keystroke hold duration deviation: ${(holdDeviation * 100).toFixed(0)}%`);
    } else if (holdDeviation > 0.25) {
      score -= 15;
    }

    // Compare typing speed
    const speedDeviation = Math.abs(current.typingSpeed - profile.typingSpeed) / Math.max(profile.typingSpeed, 1);
    if (speedDeviation > 0.5) {
      score -= 30;
      anomalies.push(`Typing speed deviation: ${(speedDeviation * 100).toFixed(0)}%`);
    } else if (speedDeviation > 0.25) {
      score -= 15;
    }

    // Compare latency
    const latencyDeviation = Math.abs(current.averageLatency - profile.averageLatency) / Math.max(profile.averageLatency, 1);
    if (latencyDeviation > 0.5) {
      score -= 20;
      anomalies.push(`Key latency deviation: ${(latencyDeviation * 100).toFixed(0)}%`);
    }

    return Math.max(0, score);
  }

  /**
   * Compare touch behavior
   */
  private compareTouchBehavior(current: TouchBehaviorProfile, anomalies: string[]): number {
    const profile = this.userProfile!.touchBehavior;
    let score = 100;

    // Compare pressure
    const pressureDeviation = Math.abs(current.averagePressure - profile.averagePressure) / Math.max(profile.averagePressure, 0.1);
    if (pressureDeviation > 0.5) {
      score -= 25;
      anomalies.push(`Touch pressure deviation: ${(pressureDeviation * 100).toFixed(0)}%`);
    }

    // Compare swipe velocity
    const velocityDeviation = Math.abs(
      current.swipeCharacteristics.averageVelocity - profile.swipeCharacteristics.averageVelocity
    ) / Math.max(profile.swipeCharacteristics.averageVelocity, 1);
    if (velocityDeviation > 0.5) {
      score -= 25;
      anomalies.push(`Swipe velocity deviation: ${(velocityDeviation * 100).toFixed(0)}%`);
    }

    // Check touch zone changes
    if (current.preferredTouchZones.length > 0 && profile.preferredTouchZones.length > 0) {
      const currentTopZone = current.preferredTouchZones[0].zone;
      const profileTopZone = profile.preferredTouchZones[0].zone;
      if (currentTopZone !== profileTopZone) {
        score -= 15;
        anomalies.push(`Different touch zone preference: ${currentTopZone} vs ${profileTopZone}`);
      }
    }

    return Math.max(0, score);
  }

  /**
   * Compare cursor metrics
   */
  private compareCursorMetrics(current: CursorMetrics, anomalies: string[]): number {
    const profile = this.userProfile!.cursorMetrics;
    let score = 100;

    // Compare velocity
    const velocityDeviation = Math.abs(current.averageVelocity - profile.averageVelocity) / Math.max(profile.averageVelocity, 1);
    if (velocityDeviation > 0.5) {
      score -= 25;
      anomalies.push(`Cursor velocity deviation: ${(velocityDeviation * 100).toFixed(0)}%`);
    }

    // Compare smoothness
    const smoothnessDeviation = Math.abs(current.smoothnessScore - profile.smoothnessScore) / 100;
    if (smoothnessDeviation > 0.3) {
      score -= 25;
      anomalies.push(`Movement smoothness deviation: ${(smoothnessDeviation * 100).toFixed(0)}%`);
    }

    // Check for unusual hesitations
    if (current.hesitations > 5 && profile.hesitations < 2) {
      score -= 20;
      anomalies.push(`Unusual number of hesitations: ${current.hesitations}`);
    }

    // Check directness ratio
    const directnessDeviation = Math.abs(current.directnessRatio - profile.directnessRatio);
    if (directnessDeviation > 0.3) {
      score -= 15;
      anomalies.push(`Movement directness deviation: ${(directnessDeviation * 100).toFixed(0)}%`);
    }

    return Math.max(0, score);
  }

  /**
   * Generate recommendation based on risk level and anomalies
   */
  private generateRecommendation(riskLevel: BBAComparisonResult['riskLevel'], anomalies: string[]): string {
    switch (riskLevel) {
      case 'low':
        return 'Behavior matches user profile. Proceed with transaction.';
      case 'medium':
        return 'Minor behavioral deviations detected. Consider additional verification for high-value transactions.';
      case 'high':
        return 'Significant behavioral anomalies detected. Require re-authentication before proceeding.';
      case 'critical':
        return 'Critical behavioral mismatch. Block transaction and verify user identity immediately.';
    }
  }

  /**
   * Get quick risk score without full analysis
   */
  getQuickRiskScore(): number {
    const anomalyScore = cursorAnalysis.getAnomalyRiskScore();

    if (!this.userProfile || this.userProfile.confidenceScore < 50) {
      return anomalyScore;
    }

    // Quick comparison with profile
    const keystrokeDynamics = this.analyzeKeystrokeDynamics();
    let behaviorScore = 100;

    if (keystrokeDynamics.typingSpeed > 0) {
      const speedDeviation = Math.abs(keystrokeDynamics.typingSpeed - this.userProfile.keystrokeDynamics.typingSpeed)
        / Math.max(this.userProfile.keystrokeDynamics.typingSpeed, 1);
      behaviorScore -= speedDeviation * 50;
    }

    const combinedRisk = Math.max(0, 100 - behaviorScore) * 0.6 + anomalyScore * 0.4;
    return Math.min(100, combinedRisk);
  }

  /**
   * Clear current keystroke events
   */
  clearCurrentEvents(): void {
    this.currentKeystrokeEvents = [];
    this.currentTouchEvents = [];
  }

  /**
   * Check if profile exists and is reliable
   */
  hasReliableProfile(): boolean {
    return this.userProfile !== null && this.userProfile.confidenceScore >= 50;
  }

  /**
   * Get profile confidence score
   */
  getProfileConfidence(): number {
    return this.userProfile?.confidenceScore || 0;
  }

  /**
   * Get current profile
   */
  getProfile(): BiometricProfile | null {
    return this.userProfile;
  }

  /**
   * Delete user profile
   */
  async deleteProfile(): Promise<void> {
    this.userProfile = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('[BBA] Profile deleted');
  }

  /**
   * Create empty keystroke dynamics
   */
  private createEmptyKeystrokeDynamics(): KeystrokeDynamics {
    return {
      averageHoldDuration: 100,
      holdDurationVariance: 0,
      averageLatency: 150,
      latencyVariance: 0,
      typingSpeed: 0,
      errorRate: 0,
      rhythmPattern: [],
      digraphTimings: new Map()
    };
  }

  /**
   * Create empty touch behavior
   */
  private createEmptyTouchBehavior(): TouchBehaviorProfile {
    return {
      averagePressure: 0.5,
      pressureConsistency: 1,
      averageTouchSize: 20,
      touchSizeConsistency: 1,
      preferredTouchZones: [],
      swipeCharacteristics: {
        averageVelocity: 500,
        velocityConsistency: 1,
        preferredDirection: 'mixed',
        averageLength: 200,
        curvature: 0
      }
    };
  }

  /**
   * Create empty cursor metrics
   */
  private createEmptyCursorMetrics(): CursorMetrics {
    return {
      totalDistance: 0,
      averageVelocity: 500,
      maxVelocity: 0,
      minVelocity: 0,
      accelerationChanges: 0,
      smoothnessScore: 80,
      directnessRatio: 0.8,
      dwellTimes: [],
      hesitations: 0,
      overshoots: 0
    };
  }
}

// Export singleton instance
export const bbaService = new BehavioralBiometricAnalysisService();
export { BehavioralBiometricAnalysisService };
