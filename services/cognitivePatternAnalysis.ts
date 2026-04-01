/**
 * Cognitive Pattern Analysis Service
 * Analyzes user cognitive patterns, decision-making behavior, and mental state indicators
 * for advanced fraud detection and user verification
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Navigation pattern data
export interface NavigationPattern {
  screenSequence: string[];
  transitionTimes: number[];
  backtrackCount: number;
  averageScreenTime: number;
  decisionPoints: DecisionPoint[];
}

// Decision point analysis
export interface DecisionPoint {
  screen: string;
  action: string;
  deliberationTime: number; // Time spent before action
  hesitationCount: number; // Number of input starts/stops
  correctionCount: number; // Number of corrections made
  confidence: number; // 0-1, inferred confidence level
  timestamp: number;
}

// Input pattern for cognitive analysis
export interface InputPattern {
  fieldId: string;
  inputType: 'text' | 'number' | 'pin' | 'otp' | 'amount';
  startTime: number;
  endTime: number;
  corrections: number;
  pauses: number;
  finalValue: string;
  inputSequence: InputSequenceEvent[];
}

// Individual input sequence events
export interface InputSequenceEvent {
  type: 'input' | 'delete' | 'pause' | 'focus' | 'blur';
  timestamp: number;
  value?: string;
  duration?: number;
}

// Cognitive load indicators
export interface CognitiveLoadIndicators {
  taskComplexity: number; // 0-100
  userFatigue: number; // 0-100
  attentionLevel: number; // 0-100
  stressIndicator: number; // 0-100
  overallCognitiveLoad: number; // 0-100
}

// Session behavior analysis
export interface SessionBehavior {
  sessionDuration: number;
  activeTime: number;
  idleTime: number;
  screenTransitions: number;
  actionsPerMinute: number;
  errorRate: number;
  completionRate: number;
}

// Cognitive profile for comparison
export interface CognitiveProfile {
  userId: string;
  createdAt: number;
  updatedAt: number;
  sampleCount: number;
  averageDecisionTime: number;
  typicalHesitationRate: number;
  normalCorrectionRate: number;
  preferredNavigationPaths: string[][];
  averageSessionBehavior: SessionBehavior;
  cognitiveBaseline: CognitiveLoadIndicators;
}

// Cognitive analysis result
export interface CognitiveAnalysisResult {
  isNormal: boolean;
  riskScore: number; // 0-100
  cognitiveLoad: CognitiveLoadIndicators;
  anomalies: CognitiveAnomaly[];
  behaviorFlags: BehaviorFlag[];
  recommendation: string;
}

// Cognitive anomaly
export interface CognitiveAnomaly {
  type: 'rushing' | 'hesitation' | 'confusion' | 'automation' | 'coercion' | 'unfamiliarity';
  severity: 'low' | 'medium' | 'high';
  description: string;
  confidence: number;
  evidence: string[];
}

// Behavior flags
export interface BehaviorFlag {
  flag: string;
  description: string;
  riskImpact: number;
}

const STORAGE_KEY = '@kavach_cognitive_profile';

// Thresholds for cognitive analysis
const COGNITIVE_THRESHOLDS = {
  MIN_DECISION_TIME: 500, // ms - too fast might indicate automation
  MAX_DECISION_TIME: 30000, // ms - too slow might indicate confusion/coercion
  NORMAL_HESITATION_RATE: 0.2, // 20% hesitation is normal
  MAX_CORRECTION_RATE: 0.3, // 30% corrections might indicate unfamiliarity
  SUSPICIOUS_SPEED_FACTOR: 0.3, // 30% faster than baseline is suspicious
  FATIGUE_THRESHOLD: 70, // Cognitive load above this suggests fatigue
};

class CognitivePatternAnalysisService {
  private userProfile: CognitiveProfile | null = null;
  private currentNavigationPattern: NavigationPattern;
  private currentInputPatterns: Map<string, InputPattern> = new Map();
  private sessionStartTime: number = 0;
  private lastActivityTime: number = 0;
  private screenStack: { screen: string; enterTime: number }[] = [];
  private actionLog: { action: string; timestamp: number; screen: string }[] = [];

  constructor() {
    this.currentNavigationPattern = this.createEmptyNavigationPattern();
    this.loadProfile();
  }

  /**
   * Load cognitive profile from storage
   */
  private async loadProfile(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.userProfile = JSON.parse(stored);
        console.log('[CognitiveAnalysis] Profile loaded');
      }
    } catch (error) {
      console.error('[CognitiveAnalysis] Failed to load profile:', error);
    }
  }

  /**
   * Save profile to storage
   */
  private async saveProfile(): Promise<void> {
    if (!this.userProfile) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.userProfile));
    } catch (error) {
      console.error('[CognitiveAnalysis] Failed to save profile:', error);
    }
  }

  /**
   * Start a new session
   */
  startSession(userId: string): void {
    this.sessionStartTime = Date.now();
    this.lastActivityTime = this.sessionStartTime;
    this.currentNavigationPattern = this.createEmptyNavigationPattern();
    this.currentInputPatterns.clear();
    this.screenStack = [];
    this.actionLog = [];

    if (!this.userProfile || this.userProfile.userId !== userId) {
      this.initializeProfile(userId);
    }

    console.log('[CognitiveAnalysis] Session started for user:', userId);
  }

  /**
   * Initialize a new profile
   */
  private initializeProfile(userId: string): void {
    this.userProfile = {
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sampleCount: 0,
      averageDecisionTime: 2000,
      typicalHesitationRate: 0.15,
      normalCorrectionRate: 0.1,
      preferredNavigationPaths: [],
      averageSessionBehavior: this.createEmptySessionBehavior(),
      cognitiveBaseline: this.createDefaultCognitiveLoad()
    };
  }

  /**
   * Record screen navigation
   */
  recordScreenNavigation(screenName: string): void {
    const now = Date.now();

    // Calculate time on previous screen
    if (this.screenStack.length > 0) {
      const prevScreen = this.screenStack[this.screenStack.length - 1];
      const timeOnScreen = now - prevScreen.enterTime;
      this.currentNavigationPattern.transitionTimes.push(timeOnScreen);
    }

    // Check for backtracking
    const prevScreenIndex = this.currentNavigationPattern.screenSequence.lastIndexOf(screenName);
    if (prevScreenIndex !== -1 && prevScreenIndex < this.currentNavigationPattern.screenSequence.length - 1) {
      this.currentNavigationPattern.backtrackCount++;
    }

    this.currentNavigationPattern.screenSequence.push(screenName);
    this.screenStack.push({ screen: screenName, enterTime: now });
    this.lastActivityTime = now;

    console.log(`[CognitiveAnalysis] Screen: ${screenName}, Backtrack count: ${this.currentNavigationPattern.backtrackCount}`);
  }

  /**
   * Record user action
   */
  recordAction(action: string, screen: string): void {
    const now = Date.now();
    this.actionLog.push({ action, timestamp: now, screen });
    this.lastActivityTime = now;
  }

  /**
   * Start tracking input on a field
   */
  startInputTracking(fieldId: string, inputType: InputPattern['inputType']): void {
    const pattern: InputPattern = {
      fieldId,
      inputType,
      startTime: Date.now(),
      endTime: 0,
      corrections: 0,
      pauses: 0,
      finalValue: '',
      inputSequence: [{ type: 'focus', timestamp: Date.now() }]
    };
    this.currentInputPatterns.set(fieldId, pattern);
  }

  /**
   * Record input change
   */
  recordInputChange(fieldId: string, value: string, isDelete: boolean = false): void {
    const pattern = this.currentInputPatterns.get(fieldId);
    if (!pattern) return;

    const now = Date.now();
    const lastEvent = pattern.inputSequence[pattern.inputSequence.length - 1];

    // Check for pause (more than 1 second between inputs)
    if (lastEvent && now - lastEvent.timestamp > 1000) {
      pattern.pauses++;
      pattern.inputSequence.push({ type: 'pause', timestamp: now, duration: now - lastEvent.timestamp });
    }

    if (isDelete) {
      pattern.corrections++;
      pattern.inputSequence.push({ type: 'delete', timestamp: now, value });
    } else {
      pattern.inputSequence.push({ type: 'input', timestamp: now, value });
    }

    pattern.finalValue = value;
    this.lastActivityTime = now;
  }

  /**
   * End input tracking on a field
   */
  endInputTracking(fieldId: string): InputPattern | null {
    const pattern = this.currentInputPatterns.get(fieldId);
    if (!pattern) return null;

    pattern.endTime = Date.now();
    pattern.inputSequence.push({ type: 'blur', timestamp: pattern.endTime });

    // Create decision point
    const deliberationTime = pattern.endTime - pattern.startTime;
    const decisionPoint: DecisionPoint = {
      screen: this.screenStack[this.screenStack.length - 1]?.screen || 'unknown',
      action: `input_${fieldId}`,
      deliberationTime,
      hesitationCount: pattern.pauses,
      correctionCount: pattern.corrections,
      confidence: this.calculateInputConfidence(pattern),
      timestamp: pattern.endTime
    };

    this.currentNavigationPattern.decisionPoints.push(decisionPoint);
    return pattern;
  }

  /**
   * Calculate confidence based on input pattern
   */
  private calculateInputConfidence(pattern: InputPattern): number {
    let confidence = 1.0;

    // Reduce confidence based on corrections
    confidence -= pattern.corrections * 0.1;

    // Reduce confidence based on excessive pauses
    if (pattern.pauses > 3) {
      confidence -= (pattern.pauses - 3) * 0.05;
    }

    // Very fast input might indicate pasting/automation
    const inputDuration = pattern.endTime - pattern.startTime;
    const expectedDuration = pattern.finalValue.length * 200; // 200ms per character
    if (inputDuration < expectedDuration * 0.3) {
      confidence -= 0.3;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Analyze cognitive load indicators
   */
  analyzeCognitiveLoad(): CognitiveLoadIndicators {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const decisionPoints = this.currentNavigationPattern.decisionPoints;

    // Task complexity based on screens visited and actions taken
    const screenCount = this.currentNavigationPattern.screenSequence.length;
    const actionCount = this.actionLog.length;
    const taskComplexity = Math.min(100, (screenCount * 5) + (actionCount * 2));

    // User fatigue based on session duration and error rate
    const hourInMs = 3600000;
    const fatigueFactor = Math.min(1, sessionDuration / hourInMs);
    const errorRate = this.calculateErrorRate();
    const userFatigue = Math.min(100, (fatigueFactor * 50) + (errorRate * 50));

    // Attention level based on response times and consistency
    const avgDecisionTime = decisionPoints.length > 0
      ? decisionPoints.reduce((sum, dp) => sum + dp.deliberationTime, 0) / decisionPoints.length
      : 2000;
    const attentionLevel = this.calculateAttentionLevel(avgDecisionTime);

    // Stress indicator based on corrections, hesitations, and speed
    const totalCorrections = decisionPoints.reduce((sum, dp) => sum + dp.correctionCount, 0);
    const totalHesitations = decisionPoints.reduce((sum, dp) => sum + dp.hesitationCount, 0);
    const stressIndicator = Math.min(100, (totalCorrections * 10) + (totalHesitations * 5) + (this.currentNavigationPattern.backtrackCount * 15));

    const overallCognitiveLoad = (taskComplexity * 0.2) + (userFatigue * 0.3) + ((100 - attentionLevel) * 0.2) + (stressIndicator * 0.3);

    return {
      taskComplexity,
      userFatigue,
      attentionLevel,
      stressIndicator,
      overallCognitiveLoad
    };
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const totalInputs = this.currentInputPatterns.size;
    if (totalInputs === 0) return 0;

    let totalCorrections = 0;
    this.currentInputPatterns.forEach(pattern => {
      totalCorrections += pattern.corrections;
    });

    return Math.min(1, totalCorrections / (totalInputs * 5)); // Normalize by expected corrections
  }

  /**
   * Calculate attention level
   */
  private calculateAttentionLevel(avgDecisionTime: number): number {
    // Optimal decision time range: 1000-5000ms
    if (avgDecisionTime < 500) return 50; // Too fast, possibly not paying attention
    if (avgDecisionTime < 1000) return 70;
    if (avgDecisionTime <= 5000) return 100;
    if (avgDecisionTime <= 10000) return 80;
    if (avgDecisionTime <= 20000) return 60;
    return 40; // Very slow, possibly distracted
  }

  /**
   * Perform full cognitive analysis
   */
  performAnalysis(): CognitiveAnalysisResult {
    const cognitiveLoad = this.analyzeCognitiveLoad();
    const anomalies = this.detectAnomalies(cognitiveLoad);
    const behaviorFlags = this.identifyBehaviorFlags();

    // Calculate risk score
    let riskScore = 0;
    anomalies.forEach(a => {
      switch (a.severity) {
        case 'high': riskScore += 30 * a.confidence; break;
        case 'medium': riskScore += 15 * a.confidence; break;
        case 'low': riskScore += 5 * a.confidence; break;
      }
    });
    behaviorFlags.forEach(f => riskScore += f.riskImpact);
    riskScore = Math.min(100, riskScore);

    const isNormal = riskScore < 40 && cognitiveLoad.overallCognitiveLoad < COGNITIVE_THRESHOLDS.FATIGUE_THRESHOLD;
    const recommendation = this.generateRecommendation(riskScore, anomalies, cognitiveLoad);

    const result: CognitiveAnalysisResult = {
      isNormal,
      riskScore,
      cognitiveLoad,
      anomalies,
      behaviorFlags,
      recommendation
    };

    console.log('[CognitiveAnalysis] Analysis result:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Detect cognitive anomalies
   */
  private detectAnomalies(cognitiveLoad: CognitiveLoadIndicators): CognitiveAnomaly[] {
    const anomalies: CognitiveAnomaly[] = [];
    const decisionPoints = this.currentNavigationPattern.decisionPoints;

    // Check for rushing behavior
    const fastDecisions = decisionPoints.filter(dp => dp.deliberationTime < COGNITIVE_THRESHOLDS.MIN_DECISION_TIME);
    if (fastDecisions.length > decisionPoints.length * 0.5) {
      anomalies.push({
        type: 'rushing',
        severity: 'medium',
        description: 'User is making decisions unusually fast',
        confidence: 0.7,
        evidence: [`${fastDecisions.length} of ${decisionPoints.length} decisions made in under 500ms`]
      });
    }

    // Check for automation patterns
    if (this.detectAutomationPattern()) {
      anomalies.push({
        type: 'automation',
        severity: 'high',
        description: 'Possible automated/bot behavior detected',
        confidence: 0.8,
        evidence: ['Consistent timing patterns', 'No natural hesitation']
      });
    }

    // Check for hesitation/confusion
    const hesitantDecisions = decisionPoints.filter(dp => dp.hesitationCount > 3);
    if (hesitantDecisions.length > decisionPoints.length * 0.4) {
      anomalies.push({
        type: 'hesitation',
        severity: 'medium',
        description: 'User showing signs of confusion or hesitation',
        confidence: 0.6,
        evidence: [`High hesitation in ${hesitantDecisions.length} decisions`]
      });
    }

    // Check for potential coercion (very slow, many corrections, high stress)
    if (cognitiveLoad.stressIndicator > 70 && cognitiveLoad.userFatigue < 30) {
      const slowDecisions = decisionPoints.filter(dp => dp.deliberationTime > COGNITIVE_THRESHOLDS.MAX_DECISION_TIME);
      if (slowDecisions.length > 0) {
        anomalies.push({
          type: 'coercion',
          severity: 'high',
          description: 'Behavioral patterns may indicate user is under duress',
          confidence: 0.5,
          evidence: ['High stress indicators', 'Unusually slow decisions', 'Multiple corrections']
        });
      }
    }

    // Check for unfamiliarity
    if (this.currentNavigationPattern.backtrackCount > 3) {
      anomalies.push({
        type: 'unfamiliarity',
        severity: 'low',
        description: 'User appears unfamiliar with the application',
        confidence: 0.6,
        evidence: [`${this.currentNavigationPattern.backtrackCount} navigation backtracks`]
      });
    }

    return anomalies;
  }

  /**
   * Detect automation patterns
   */
  private detectAutomationPattern(): boolean {
    const decisionPoints = this.currentNavigationPattern.decisionPoints;
    if (decisionPoints.length < 5) return false;

    // Check for suspiciously consistent timing
    const times = decisionPoints.map(dp => dp.deliberationTime);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // Very low variance in timing is suspicious
    if (stdDev < avgTime * 0.1 && avgTime < 1000) {
      return true;
    }

    // Check for no hesitations at all
    const totalHesitations = decisionPoints.reduce((sum, dp) => sum + dp.hesitationCount, 0);
    if (totalHesitations === 0 && decisionPoints.length > 5) {
      return true;
    }

    return false;
  }

  /**
   * Identify behavior flags
   */
  private identifyBehaviorFlags(): BehaviorFlag[] {
    const flags: BehaviorFlag[] = [];

    // Check session duration
    const sessionDuration = Date.now() - this.sessionStartTime;
    if (sessionDuration < 30000 && this.actionLog.length > 10) {
      flags.push({
        flag: 'RAPID_SESSION',
        description: 'Very fast session with many actions',
        riskImpact: 15
      });
    }

    // Check for unusual navigation
    if (this.currentNavigationPattern.backtrackCount > 5) {
      flags.push({
        flag: 'EXCESSIVE_BACKTRACKING',
        description: 'User navigating back frequently',
        riskImpact: 10
      });
    }

    // Check input patterns
    let highCorrectionFields = 0;
    this.currentInputPatterns.forEach(pattern => {
      if (pattern.corrections > pattern.finalValue.length * 0.5) {
        highCorrectionFields++;
      }
    });
    if (highCorrectionFields > 2) {
      flags.push({
        flag: 'HIGH_INPUT_CORRECTIONS',
        description: 'Multiple fields with many corrections',
        riskImpact: 10
      });
    }

    // Compare with profile if available
    if (this.userProfile && this.userProfile.sampleCount >= 3) {
      const currentAvgDecision = this.currentNavigationPattern.decisionPoints.length > 0
        ? this.currentNavigationPattern.decisionPoints.reduce((sum, dp) => sum + dp.deliberationTime, 0)
          / this.currentNavigationPattern.decisionPoints.length
        : 0;

      if (currentAvgDecision < this.userProfile.averageDecisionTime * COGNITIVE_THRESHOLDS.SUSPICIOUS_SPEED_FACTOR) {
        flags.push({
          flag: 'FASTER_THAN_BASELINE',
          description: 'User is significantly faster than their usual behavior',
          riskImpact: 20
        });
      }
    }

    return flags;
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    riskScore: number,
    anomalies: CognitiveAnomaly[],
    cognitiveLoad: CognitiveLoadIndicators
  ): string {
    if (riskScore < 20) {
      return 'Normal cognitive patterns detected. Proceed with transaction.';
    }

    if (anomalies.some(a => a.type === 'coercion')) {
      return 'ALERT: Possible coercion detected. Consider additional security measures or intervention.';
    }

    if (anomalies.some(a => a.type === 'automation')) {
      return 'WARNING: Automated behavior patterns detected. Require CAPTCHA or additional verification.';
    }

    if (cognitiveLoad.overallCognitiveLoad > COGNITIVE_THRESHOLDS.FATIGUE_THRESHOLD) {
      return 'User appears fatigued. Consider suggesting a break before completing sensitive transactions.';
    }

    if (riskScore > 60) {
      return 'Multiple cognitive anomalies detected. Require re-authentication before proceeding.';
    }

    return 'Minor cognitive pattern deviations. Consider additional verification for high-value transactions.';
  }

  /**
   * Update profile with current session data
   */
  updateProfile(): void {
    if (!this.userProfile) return;

    const decisionPoints = this.currentNavigationPattern.decisionPoints;
    if (decisionPoints.length === 0) return;

    const sampleCount = this.userProfile.sampleCount;
    const weight = sampleCount / (sampleCount + 1);
    const newWeight = 1 / (sampleCount + 1);

    // Update average decision time
    const avgDecision = decisionPoints.reduce((sum, dp) => sum + dp.deliberationTime, 0) / decisionPoints.length;
    this.userProfile.averageDecisionTime = this.userProfile.averageDecisionTime * weight + avgDecision * newWeight;

    // Update hesitation rate
    const hesitationRate = decisionPoints.reduce((sum, dp) => sum + dp.hesitationCount, 0) / (decisionPoints.length * 5);
    this.userProfile.typicalHesitationRate = this.userProfile.typicalHesitationRate * weight + hesitationRate * newWeight;

    // Update correction rate
    const correctionRate = decisionPoints.reduce((sum, dp) => sum + dp.correctionCount, 0) / (decisionPoints.length * 5);
    this.userProfile.normalCorrectionRate = this.userProfile.normalCorrectionRate * weight + correctionRate * newWeight;

    // Update navigation paths
    if (this.currentNavigationPattern.screenSequence.length > 2) {
      this.userProfile.preferredNavigationPaths.push([...this.currentNavigationPattern.screenSequence]);
      if (this.userProfile.preferredNavigationPaths.length > 10) {
        this.userProfile.preferredNavigationPaths.shift();
      }
    }

    this.userProfile.sampleCount++;
    this.userProfile.updatedAt = Date.now();
    this.saveProfile();

    console.log(`[CognitiveAnalysis] Profile updated. Samples: ${this.userProfile.sampleCount}`);
  }

  /**
   * Get current session behavior metrics
   */
  getSessionBehavior(): SessionBehavior {
    const now = Date.now();
    const sessionDuration = now - this.sessionStartTime;
    const idleTime = now - this.lastActivityTime;
    const activeTime = sessionDuration - idleTime;

    return {
      sessionDuration,
      activeTime,
      idleTime,
      screenTransitions: this.currentNavigationPattern.screenSequence.length,
      actionsPerMinute: this.actionLog.length / (sessionDuration / 60000),
      errorRate: this.calculateErrorRate(),
      completionRate: 1 // TODO: Track completion
    };
  }

  /**
   * Create empty navigation pattern
   */
  private createEmptyNavigationPattern(): NavigationPattern {
    return {
      screenSequence: [],
      transitionTimes: [],
      backtrackCount: 0,
      averageScreenTime: 0,
      decisionPoints: []
    };
  }

  /**
   * Create empty session behavior
   */
  private createEmptySessionBehavior(): SessionBehavior {
    return {
      sessionDuration: 0,
      activeTime: 0,
      idleTime: 0,
      screenTransitions: 0,
      actionsPerMinute: 0,
      errorRate: 0,
      completionRate: 0
    };
  }

  /**
   * Create default cognitive load
   */
  private createDefaultCognitiveLoad(): CognitiveLoadIndicators {
    return {
      taskComplexity: 30,
      userFatigue: 10,
      attentionLevel: 80,
      stressIndicator: 20,
      overallCognitiveLoad: 25
    };
  }

  /**
   * Get user profile
   */
  getProfile(): CognitiveProfile | null {
    return this.userProfile;
  }

  /**
   * Delete profile
   */
  async deleteProfile(): Promise<void> {
    this.userProfile = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Clear current session data
   */
  clearSession(): void {
    this.currentNavigationPattern = this.createEmptyNavigationPattern();
    this.currentInputPatterns.clear();
    this.screenStack = [];
    this.actionLog = [];
  }
}

// Export singleton
export const cognitiveAnalysis = new CognitivePatternAnalysisService();
export { CognitivePatternAnalysisService };
