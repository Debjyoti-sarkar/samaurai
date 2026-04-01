/**
 * Case Repository - Data access layer for cases
 */

const Case = require("../models/Case");

class CaseRepository {
  async createCase(caseData) {
    const caseRecord = new Case(caseData);
    return await caseRecord.save();
  }

  async findCaseById(caseId) {
    return await Case.findById(caseId)
      .populate("primaryUser")
      .populate("associatedEvents")
      .populate("involvedTransactions");
  }

  async findCasesByStatus(status, limit = 50) {
    return await Case.find({ status })
      .sort({ initiatedAt: -1 })
      .limit(limit);
  }

  async findCasesByUser(userId, limit = 50) {
    return await Case.find({ primaryUser: userId })
      .sort({ initiatedAt: -1 })
      .limit(limit);
  }

  async findOpenCases(limit = 100) {
    return await Case.find({
      status: { $in: ["open", "investigating"] },
    })
      .sort({ severity: -1, initiatedAt: -1 })
      .limit(limit);
  }

  async updateCase(caseId, updateData) {
    updateData.updatedAt = new Date();
    return await Case.findByIdAndUpdate(caseId, updateData, { new: true });
  }

  async resolveCase(caseId, resolution) {
    return await Case.findByIdAndUpdate(
      caseId,
      {
        status: "resolved",
        resolution,
        resolvedAt: new Date(),
      },
      { new: true }
    );
  }

  async getCaseStats() {
    return await Case.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async addCaseActivity(caseId, action, actor, details) {
    return await Case.findByIdAndUpdate(
      caseId,
      {
        $push: {
          activityLog: {
            action,
            actor,
            details,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );
  }
}

module.exports = new CaseRepository();
