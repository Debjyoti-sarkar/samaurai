/**
 * Event Repository - Data access layer for events
 */

const Event = require("../models/Event");

class EventRepository {
  async createEvent(eventData) {
    const event = new Event(eventData);
    return await event.save();
  }

  async findEventById(eventId) {
    return await Event.findById(eventId);
  }

  async findEventsByUserId(userId, limit = 100) {
    return await Event.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findRecentEvents(hours = 24, limit = 1000) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await Event.find({
      timestamp: { $gte: cutoffTime },
    })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findEventsByType(eventType, limit = 100) {
    return await Event.find({ eventType })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findHighRiskEvents(limit = 100) {
    return await Event.find({
      riskLevel: { $in: ["high", "critical"] },
    })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async updateEvent(eventId, updateData) {
    return await Event.findByIdAndUpdate(eventId, updateData, { new: true });
  }

  async deleteEvent(eventId) {
    return await Event.findByIdAndDelete(eventId);
  }

  async getEventStats(userId, hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    return await Event.aggregate([
      {
        $match: {
          userId: userId,
          timestamp: { $gte: cutoffTime },
        },
      },
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
        },
      },
    ]);
  }
}

module.exports = new EventRepository();
