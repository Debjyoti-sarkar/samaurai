/**
 * Case Management Service
 */

const Case = require("../models/Case");
const Alert = require("../models/Alert");
const caseRepository = require("../repositories/CaseRepository");
const { v4: uuidv4 } = require("uuid");

class CaseManagementService {
  /**
   * Create a new case
   */
  async createCase(caseData) {
    try {
      return await caseRepository.createCase({
        caseId: `case-${uuidv4()}`,
        ...caseData,
        initiatedAt: new Date(),
        activityLog: [
          {
            action: "case_created",
            timestamp: new Date(),
            details: "Case created",
          },
        ],
      });
    } catch (error) {
      console.error("Error creating case:", error);
      throw error;
    }
  }

  /**
   * Get case details
   */
  async getCaseDetails(caseId) {
    try {
      return await caseRepository.findCaseById(caseId);
    } catch (error) {
      console.error("Error getting case details:", error);
      throw error;
    }
  }

  /**
   * Update case status
   */
  async updateCaseStatus(caseId, newStatus, notes = "") {
    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === "resolved" || newStatus === "closed") {
        updateData.resolvedAt = new Date();
      }

      const caseRecord = await caseRepository.updateCase(caseId, updateData);

      // Log activity
      await caseRepository.addCaseActivity(
        caseId,
        `status_changed_to_${newStatus}`,
        null,
        notes
      );

      return caseRecord;
    } catch (error) {
      console.error("Error updating case status:", error);
      throw error;
    }
  }

  /**
   * Assign analyst to case
   */
  async assignAnalyst(caseId, analystId) {
    try {
      return await caseRepository.updateCase(caseId, {
        $push: {
          assignedTo: {
            userId: analystId,
            role: "investigator",
            assignedAt: new Date(),
          },
        },
      });
    } catch (error) {
      console.error("Error assigning analyst:", error);
      throw error;
    }
  }

  /**
   * Add evidence to case
   */
  async addEvidence(caseId, evidence) {
    try {
      return await caseRepository.updateCase(caseId, {
        $push: {
          evidence: {
            type: evidence.type,
            description: evidence.description,
            sourceEventId: evidence.sourceEventId,
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      console.error("Error adding evidence:", error);
      throw error;
    }
  }

  /**
   * Resolve case
   */
  async resolveCase(caseId, resolution, resolvedBy) {
    try {
      return await Case.findByIdAndUpdate(
        caseId,
        {
          status: "resolved",
          resolvedAt: new Date(),
          resolvedBy,
          resolution,
        },
        { new: true }
      );
    } catch (error) {
      console.error("Error resolving case:", error);
      throw error;
    }
  }

  /**
   * Get cases by status
   */
  async getCasesByStatus(status) {
    try {
      return await caseRepository.findCasesByStatus(status);
    } catch (error) {
      console.error("Error getting cases by status:", error);
      throw error;
    }
  }

  /**
   * Get user's cases
   */
  async getUserCases(userId) {
    try {
      return await caseRepository.findCasesByUser(userId);
    } catch (error) {
      console.error("Error getting user cases:", error);
      throw error;
    }
  }

  /**
   * Get case statistics
   */
  async getCaseStatistics() {
    try {
      return await caseRepository.getCaseStats();
    } catch (error) {
      console.error("Error getting case statistics:", error);
      throw error;
    }
  }

  /**
   * Link transaction to case
   */
  async linkTransactionToCase(caseId, transactionId) {
    try {
      return await caseRepository.updateCase(caseId, {
        $addToSet: {
          involvedTransactions: transactionId,
        },
      });
    } catch (error) {
      console.error("Error linking transaction to case:", error);
      throw error;
    }
  }

  /**
   * Link user to case
   */
  async linkUserToCase(caseId, userId, role = "involved") {
    try {
      return await caseRepository.updateCase(caseId, {
        $addToSet: {
          involvedUsers: {
            userId,
            role,
            addedAt: new Date(),
          },
        },
      });
    } catch (error) {
      console.error("Error linking user to case:", error);
      throw error;
    }
  }
}

module.exports = new CaseManagementService();
