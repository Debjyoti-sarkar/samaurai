/**
 * Behavior Tracker Service
 * Collects and processes user behavioral events
 */

const { v4: uuidv4 } = require('uuid');
const BehaviorEvent = require('../models/BehaviorEvent');
const UserBehaviorProfile = require('../models/UserBehavior');
const Transaction = require('../models/Transaction');

class BehaviorTracker {
  constructor() {
    this.eventQueue = [];
    this.flushInterval = 5000; // Flush every 5 seconds
    this.maxQueueSize = 100;
    this.isProcessing = false;

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Track a behavioral event
   * @param {Object} eventData - Event data to track
   */
  async trackEvent(eventData) {
    const event = {
      eventId: uuidv4(),
      timestamp: new Date(),
      serverTimestamp: new Date(),
      ...eventData
    };

    // Add to queue for batch processing
    this.eventQueue.push(event);

    // Flush if queue is full
    if (this.eventQueue.length >= this.maxQueueSize) {
      await this.flushEvents();
    }

    return event.eventId;
  }

  /**
   * Track authentication event
   */
  async trackAuthEvent(userId, eventType, success, details = {}) {
    return this.trackEvent({
      userId,
      eventType,
      category: 'authentication',
      eventData: {
        authMethod: details.authMethod || 'unknown',
        attemptNumber: details.attemptNumber || 1,
        errorCode: success ? null : details.errorCode,
        errorMessage: success ? null : details.errorMessage,
        additionalData: details.additionalData
      },
      deviceInfo: details.deviceInfo || {},
      locationInfo: details.locationInfo || {},
      sessionId: details.sessionId
    });
  }

  /**
   * Track transaction event
   */
  async trackTransactionEvent(userId, eventType, transactionData) {
    return this.trackEvent({
      userId,
      eventType,
      category: 'transaction',
      eventData: {
        transactionId: transactionData.transactionId,
        amount: transactionData.amount,
        recipientUpiId: transactionData.recipientUpiId,
        recipientName: transactionData.recipientName,
        additionalData: transactionData.additionalData
      },
      deviceInfo: transactionData.deviceInfo || {},
      locationInfo: transactionData.locationInfo || {},
      sessionId: transactionData.sessionId
    });
  }

  /**
   * Track navigation/screen event
   */
  async trackScreenEvent(userId, screenName, previousScreen, details = {}) {
    return this.trackEvent({
      userId,
      eventType: 'screen_view',
      category: 'navigation',
      eventData: {
        screenName,
        previousScreen,
        additionalData: details.additionalData
      },
      deviceInfo: details.deviceInfo || {},
      locationInfo: details.locationInfo || {},
      sessionId: details.sessionId,
      behavioralMetrics: {
        focusTime: details.focusTime,
        interactionCount: details.interactionCount
      }
    });
  }

  /**
   * Track security event
   */
  async trackSecurityEvent(userId, eventType, details = {}) {
    return this.trackEvent({
      userId,
      eventType,
      category: 'security',
      eventData: details.eventData || {},
      deviceInfo: details.deviceInfo || {},
      locationInfo: details.locationInfo || {},
      sessionId: details.sessionId,
      riskIndicators: {
        isUnusualTime: details.isUnusualTime,
        isUnusualDevice: details.isUnusualDevice,
        isUnusualLocation: details.isUnusualLocation,
        riskScore: details.riskScore || 0,
        flagged: details.flagged || false
      }
    });
  }

  /**
   * Track behavioral metrics (typing, touch patterns)
   */
  async trackBehavioralMetrics(userId, sessionId, metrics) {
    return this.trackEvent({
      userId,
      eventType: 'custom',
      category: 'other',
      sessionId,
      behavioralMetrics: {
        touchPressure: metrics.touchPressure,
        touchDuration: metrics.touchDuration,
        swipeVelocity: metrics.swipeVelocity,
        scrollSpeed: metrics.scrollSpeed,
        typingSpeed: metrics.typingSpeed,
        keystrokeIntervals: metrics.keystrokeIntervals,
        backspaceFrequency: metrics.backspaceFrequency,
        pasteUsed: metrics.pasteUsed,
        idleTime: metrics.idleTime,
        focusTime: metrics.focusTime,
        interactionCount: metrics.interactionCount
      }
    });
  }

  /**
   * Start periodic flush of event queue
   */
  startPeriodicFlush() {
    setInterval(async () => {
      if (this.eventQueue.length > 0 && !this.isProcessing) {
        await this.flushEvents();
      }
    }, this.flushInterval);
  }

  /**
   * Flush events to database
   */
  async flushEvents() {
    if (this.eventQueue.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Batch insert events
      await BehaviorEvent.insertMany(eventsToProcess, { ordered: false });
      console.log(`[BehaviorTracker] Flushed ${eventsToProcess.length} events`);
    } catch (error) {
      console.error('[BehaviorTracker] Error flushing events:', error.message);
      // Re-add failed events to queue (with limit)
      if (this.eventQueue.length < this.maxQueueSize * 2) {
        this.eventQueue = [...eventsToProcess, ...this.eventQueue];
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get user's recent events
   */
  async getUserEvents(userId, limit = 100) {
    return BehaviorEvent.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Get session events
   */
  async getSessionEvents(sessionId) {
    return BehaviorEvent.getSessionEvents(sessionId);
  }

  /**
   * Calculate session metrics
   */
  async calculateSessionMetrics(sessionId) {
    return BehaviorEvent.calculateSessionMetrics(sessionId);
  }

  /**
   * Detect anomalies in recent events
   */
  async detectEventAnomalies(userId, windowMinutes = 30) {
    return BehaviorEvent.detectAnomalies(userId, windowMinutes);
  }

  /**
   * Get event frequency pattern for user
   */
  async getEventFrequencyPattern(userId, days = 7) {
    return BehaviorEvent.getEventFrequencyPattern(userId, days);
  }

  /**
   * Force flush (for graceful shutdown)
   */
  async forceFlush() {
    await this.flushEvents();
  }
}

// Singleton instance
const behaviorTracker = new BehaviorTracker();

module.exports = behaviorTracker;
