/**
 * Event Correlation Engine - Detects patterns and relationships between events
 * Correlates events from the same user, device, timeframe
 * Identifies suspicious patterns like:
 * - Same device on multiple accounts
 * - Rapid transactions
 * - Unusual login locations
 */

const Event = require("../../models/Event");
const Case = require("../../models/Case");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const EntityRelationship = require("../../models/EntityRelationship");
const { v4: uuidv4 } = require("uuid");

class EventCorrelationEngine {
  /**
   * Create an event in the system
   */
  async createEvent(eventData) {
    try {
      const event = new Event({
        eventId: `evt-${uuidv4()}`,
        eventType: eventData.eventType,
        userId: eventData.userId,
        deviceId: eventData.deviceId,
        transactionId: eventData.transactionId,
        description: eventData.description,
        severity: eventData.severity || "medium",
        metadata: eventData.metadata,
        ipAddress: eventData.ipAddress,
        location: eventData.location,
        timestamp: eventData.timestamp || new Date(),
      });

      await event.save();
      return event;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  }

  /**
   * Correlate recent events for a user
   * Detects suspicious patterns and relationships
   */
  async correlateUserEvents(userId, timeWindowHours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

      // Fetch recent events for user
      const recentEvents = await Event.find({
        userId: userId,
        timestamp: { $gte: cutoffTime },
        status: { $ne: "correlated" },
      }).sort({ timestamp: -1 });

      if (recentEvents.length < 2) return [];

      const correlations = [];

      // Analyze event pairs for correlations
      for (let i = 0; i < recentEvents.length; i++) {
        for (let j = i + 1; j < recentEvents.length; j++) {
          const event1 = recentEvents[i];
          const event2 = recentEvents[j];

          const similarity = this._calculateEventSimilarity(event1, event2);

          if (similarity > 40) {
            // Threshold for correlation
            correlations.push({
              event1Id: event1._id,
              event2Id: event2._id,
              event1EventType: event1.eventType,
              event2EventType: event2.eventType,
              similarity,
              pattern: this._identifyPattern(event1, event2),
            });
          }
        }
      }

      // Update events with correlation results
      for (const event of recentEvents) {
        const eventCorrelations = correlations
          .filter(
            (c) =>
              c.event1Id.equals(event._id) || c.event2Id.equals(event._id)
          )
          .map((c) => ({
            eventId: c.event1Id.equals(event._id) ? c.event2Id : c.event1Id,
            type: c.event1Id.equals(event._id) ? c.event2EventType : c.event1EventType,
            similarity: c.similarity,
          }));

        if (eventCorrelations.length > 0) {
          event.correlatedEvents = eventCorrelations;
          event.status = "correlated";
          await event.save();
        }
      }

      return correlations;
    } catch (error) {
      console.error("Error correlating user events:", error);
      throw error;
    }
  }

  /**
   * Detect suspicious patterns across all events
   */
  async detectSuspiciousPatterns() {
    try {
      const alerts = [];
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Pattern 1: Same device on multiple accounts
      const eventsByDevice = await Event.aggregate([
        {
          $match: {
            deviceId: { $exists: true, $ne: null },
            timestamp: { $gte: cutoffTime },
          },
        },
        {
          $group: {
            _id: "$deviceId",
            userIds: { $addToSet: "$userId" },
            eventCount: { $sum: 1 },
          },
        },
        {
          $match: {
            "userIds.1": { $exists: true }, // More than one user
          },
        },
      ]);

      for (const group of eventsByDevice) {
        alerts.push({
          patternType: "device_multiple_users",
          severity: "high",
          deviceId: group._id,
          userIds: group.userIds,
          count: group.eventCount,
          description: `Device ${group._id} used by ${group.userIds.length} different users`,
        });
      }

      // Pattern 2: Same location with different devices
      const eventsByLocation = await Event.aggregate([
        {
          $match: {
            "location.city": { $exists: true },
            timestamp: { $gte: cutoffTime },
          },
        },
        {
          $group: {
            _id: { userId: "$userId", location: "$location.city" },
            deviceIds: { $addToSet: "$deviceId" },
            eventCount: { $sum: 1 },
          },
        },
        {
          $match: {
            "deviceIds.1": { $exists: true }, // More than one device
          },
        },
      ]);

      for (const group of eventsByLocation) {
        if (group.deviceIds.length > 2) {
          alerts.push({
            patternType: "location_multiple_devices",
            severity: "medium",
            userId: group._id.userId,
            location: group._id.location,
            deviceIds: group.deviceIds,
            count: group.eventCount,
            description: `Location ${group._id.location} accessed with ${group.deviceIds.length} different devices`,
          });
        }
      }

      // Pattern 3: Rapid event sequence (velocity check)
      const userEvents = await Event.aggregate([
        {
          $match: {
            timestamp: { $gte: cutoffTime },
            eventType: { $in: ["transaction", "login_attempt"] },
          },
        },
        {
          $group: {
            _id: "$userId",
            events: { $push: { timestamp: "$timestamp", type: "$eventType" } },
          },
        },
      ]);

      for (const user of userEvents) {
        const sortedEvents = user.events.sort(
          (a, b) => a.timestamp - b.timestamp
        );

        // Check if more than 5 events in less than 5 minutes
        for (let i = 0; i < sortedEvents.length - 4; i++) {
          const timeDiff =
            (sortedEvents[i + 4].timestamp - sortedEvents[i].timestamp) / 1000 / 60; // minutes
          if (timeDiff < 5) {
            alerts.push({
              patternType: "rapid_event_sequence",
              severity: "critical",
              userId: user._id,
              eventCount: 5,
              timeframeMinutes: timeDiff,
              description: `User ${user._id} triggered 5 events in ${timeDiff.toFixed(
                1
              )} minutes`,
            });
            break; // One alert per user
          }
        }
      }

      return alerts;
    } catch (error) {
      console.error("Error detecting suspicious patterns:", error);
      throw error;
    }
  }

  /**
   * Correlate transaction with related events
   */
  async correlateTransactionEvents(transactionId) {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) throw new Error("Transaction not found");

      const correlatedEvents = await Event.find({
        userId: transaction.userId,
        timestamp: {
          $gte: new Date(transaction.timestamp.getTime() - 60 * 60 * 1000), // 1 hour before
          $lte: new Date(transaction.timestamp.getTime() + 60 * 60 * 1000), // 1 hour after
        },
      });

      // Update transaction with event correlation
      transaction.eventId = correlatedEvents.find((e) => e.transactionId?.equals(transactionId))?._id;
      await transaction.save();

      return correlatedEvents;
    } catch (error) {
      console.error("Error correlating transaction events:", error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two events (0-100)
   */
  _calculateEventSimilarity(event1, event2) {
    let similarity = 0;

    // Same event type
    if (event1.eventType === event2.eventType) similarity += 30;

    // Same device
    if (
      event1.deviceId &&
      event2.deviceId &&
      event1.deviceId === event2.deviceId
    )
      similarity += 25;

    // Same location
    if (
      event1.location?.city &&
      event2.location?.city &&
      event1.location.city === event2.location.city
    )
      similarity += 20;

    // Same IP
    if (
      event1.ipAddress &&
      event2.ipAddress &&
      event1.ipAddress === event2.ipAddress
    )
      similarity += 15;

    // Close in time (within 30 minutes)
    const timeDiff = Math.abs(event1.timestamp - event2.timestamp) / (60 * 1000); // minutes
    if (timeDiff < 30) similarity += 10;

    return Math.min(similarity, 100);
  }

  /**
   * Identify pattern type between two events
   */
  _identifyPattern(event1, event2) {
    const patterns = [];

    if (event1.eventType === event2.eventType) patterns.push("same_event_type");
    if (event1.deviceId === event2.deviceId) patterns.push("same_device");
    if (event1.location?.city === event2.location?.city) patterns.push("same_location");

    const timeDiff = Math.abs(event1.timestamp - event2.timestamp) / (60 * 1000);
    if (timeDiff < 5) patterns.push("rapid_succession");
    if (timeDiff < 60 && timeDiff > 5) patterns.push("within_hour");

    return patterns.join(" + ");
  }

  /**
   * Get correlation analysis for a specific entity
   */
  async getCorrelationAnalysis(entityType, entityId) {
    try {
      let query = {};

      if (entityType === "user") {
        query.userId = entityId;
      } else if (entityType === "device") {
        query.deviceId = entityId;
      } else if (entityType === "transaction") {
        query.transactionId = entityId;
      }

      const correlatedEvents = await Event.find(query).sort({
        timestamp: -1,
      });

      const analysis = {
        totalEvents: correlatedEvents.length,
        eventTypes: {},
        timeSeries: [],
        riskProfile: {
          highRiskCount: correlatedEvents.filter(
            (e) => e.riskLevel === "high"
          ).length,
          criticalRiskCount: correlatedEvents.filter(
            (e) => e.riskLevel === "critical"
          ).length,
        },
      };

      // Count by event type
      for (const event of correlatedEvents) {
        analysis.eventTypes[event.eventType] =
          (analysis.eventTypes[event.eventType] || 0) + 1;
      }

      return analysis;
    } catch (error) {
      console.error("Error getting correlation analysis:", error);
      throw error;
    }
  }
}

module.exports = EventCorrelationEngine;
