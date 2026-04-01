/**
 * Risk Assessment Repository
 */

const RiskAssessment = require("../models/RiskAssessment");

class RiskAssessmentRepository {
  async createAssessment(assessmentData) {
    const assessment = new RiskAssessment(assessmentData);
    return await assessment.save();
  }

  async findAssessmentById(assessmentId) {
    return await RiskAssessment.findById(assessmentId);
  }

  async findLatestAssessmentForEntity(entityType, entityId) {
    return await RiskAssessment.findOne({
      entityType,
      entityId,
    }).sort({ createdAt: -1 });
  }

  async findAssessmentsByRiskLevel(riskLevel, limit = 100) {
    return await RiskAssessment.find({ riskLevel })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getAssessmentHistory(entityId, limit = 50) {
    return await RiskAssessment.find({ entityId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async updateAssessment(assessmentId, updateData) {
    return await RiskAssessment.findByIdAndUpdate(assessmentId, updateData, {
      new: true,
    });
  }
}

module.exports = new RiskAssessmentRepository();
