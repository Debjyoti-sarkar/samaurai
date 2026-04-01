/**
 * Automation Engine - Executes rules-based actions
 * Triggers actions like block, alert, create case based on risk/events
 */

const AutomationRule = require("../../models/AutomationRule");
const Alert = require("../../models/Alert");
const Case = require("../../models/Case");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const { v4: uuidv4 } = require("uuid");

class AutomationEngine {
  constructor(eventEngine, riskEngine) {
    this.eventEngine = eventEngine;
    this.riskEngine = riskEngine;
  }

  /**
   * Create an automation rule
   */
  async createRule(ruleData) {
    try {
      const rule = new AutomationRule({
        ruleId: `rule-${uuidv4()}`,
        ...ruleData,
        isActive: true,
      });

      await rule.save();
      return rule;
    } catch (error) {
      console.error("Error creating rule:", error);
      throw error;
    }
  }

  /**
   * Evaluate and execute applicable rules
   */
  async evaluateAndExecuteRules(triggerData) {
    try {
      const { entityType, entityId, eventType, riskScore, riskLevel } =
        triggerData;

      // Find applicable rules
      const applicableRules = await AutomationRule.find({
        isActive: true,
        applicableEntityTypes: entityType,
      }).sort({ priority: -1 });

      const executedActions = [];

      for (const rule of applicableRules) {
        // Check if rule conditions are met
        if (this._evaluateRuleConditions(rule, triggerData)) {
          // Check cooldown
          const shouldExecute = await this._checkCooldown(rule, entityId);

          if (shouldExecute) {
            // Execute actions
            for (const action of rule.actions) {
              if (action.enabled) {
                const result = await this._executeAction(
                  action,
                  entityType,
                  entityId,
                  rule._id
                );

                executedActions.push({
                  ruleId: rule._id,
                  action: action.actionType,
                  status: result.status,
                  result,
                });

                // Update rule execution stats
                await AutomationRule.findByIdAndUpdate(rule._id, {
                  $inc: {
                    "executionStats.totalExecutions": 1,
                    ...(result.status === "success" && {
                      "executionStats.successfulExecutions": 1,
                    }),
                  },
                  "executionStats.lastExecutedAt": new Date(),
                  "executionStats.lastExecutedFor": entityId,
                });
              }
            }
          }
        }
      }

      return executedActions;
    } catch (error) {
      console.error("Error evaluating rules:", error);
      throw error;
    }
  }

  /**
   * Evaluate rule conditions
   */
  _evaluateRuleConditions(rule, triggerData) {
    for (const condition of rule.conditions) {
      const fieldValue = triggerData[condition.field];

      if (!this._evaluateCondition(condition.operator, fieldValue, condition.value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  _evaluateCondition(operator, fieldValue, threshold) {
    switch (operator) {
      case "gt":
        return fieldValue > threshold;
      case "gte":
        return fieldValue >= threshold;
      case "lt":
        return fieldValue < threshold;
      case "lte":
        return fieldValue <= threshold;
      case "eq":
        return fieldValue === threshold;
      case "ne":
        return fieldValue !== threshold;
      case "between":
        return fieldValue >= threshold.min && fieldValue <= threshold.max;
      case "contains":
        return String(fieldValue).includes(String(threshold));
      default:
        return false;
    }
  }

  /**
   * Check if rule cooldown has expired
   */
  async _checkCooldown(rule, entityId) {
    if (rule.cooldownSeconds === 0) return true;

    const lastExecution = rule.executionStats.lastExecutedAt;
    if (!lastExecution) return true;

    const timeSinceLastExecution = (Date.now() - lastExecution.getTime()) / 1000;
    return timeSinceLastExecution >= rule.cooldownSeconds;
  }

  /**
   * Execute an action
   */
  async _executeAction(action, entityType, entityId, ruleId) {
    try {
      let result = { status: "success", actionType: action.actionType };

      switch (action.actionType) {
        case "block_transaction":
          result = await this._blockTransaction(entityId);
          break;

        case "flag_user":
          result = await this._flagUser(entityId);
          break;

        case "send_alert":
          result = await this._sendAlert(entityId, action.parameters);
          break;

        case "create_case":
          result = await this._createCase(entityId, action.parameters, ruleId);
          break;

        case "request_verification":
          result = await this._requestVerification(entityId, action.parameters);
          break;

        case "suspend_account":
          result = await this._suspendAccount(entityId);
          break;

        case "notify_user":
          result = await this._notifyUser(entityId, action.parameters);
          break;

        case "escalate_to_analyst":
          result = await this._escalateToAnalyst(entityId);
          break;

        default:
          result = { status: "unknown_action" };
      }

      return result;
    } catch (error) {
      console.error("Error executing action:", error);
      return { status: "error", error: error.message };
    }
  }

  /**
   * Block a transaction
   */
  async _blockTransaction(transactionId) {
    try {
      const transaction = await Transaction.findByIdAndUpdate(
        transactionId,
        {
          status: "flagged",
          isFlagged: true,
        },
        { new: true }
      );

      return {
        status: "success",
        message: "Transaction blocked",
        transactionId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Flag a user
   */
  async _flagUser(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          accountStatus: "under_review",
          underInvestigation: true,
        },
        { new: true }
      );

      return {
        status: "success",
        message: "User flagged for review",
        userId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Send alert
   */
  async _sendAlert(targetId, parameters = {}) {
    try {
      const alert = new Alert({
        alertId: `alert-${uuidv4()}`,
        alertType: parameters.alertType || "rule_violation",
        severity: parameters.severity || "high",
        triggerSource: "automation_rule",
        primaryUserId: targetId,
        title: parameters.title || "Automation Alert",
        message: parameters.message || "Rule triggered",
        status: "new",
      });

      await alert.save();

      // TODO: Send notification via channels defined in parameters.channels

      return {
        status: "success",
        message: "Alert created",
        alertId: alert.alertId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Create a case
   */
  async _createCase(userId, parameters = {}, ruleId) {
    try {
      const caseRecord = new Case({
        caseId: `case-${uuidv4()}`,
        title: parameters.title || "Automated Case from Rule",
        description: parameters.description || "Created by automation rule",
        caseType: parameters.caseType || "suspicious_activity",
        severity: parameters.severity || "high",
        primaryUser: userId,
        automationRuleTriggered: ruleId,
        status: "open",
      });

      await caseRecord.save();

      return {
        status: "success",
        message: "Case created",
        caseId: caseRecord.caseId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Request verification from user
   */
  async _requestVerification(entityId, parameters = {}) {
    try {
      // Update transaction or user to require verification
      if (parameters.entityType === "transaction") {
        await Transaction.findByIdAndUpdate(entityId, {
          verificationRequired: true,
          verificationMethods: parameters.methods || [
            "otp",
            "biometric",
          ],
        });
      }

      return {
        status: "success",
        message: "Verification requested",
        entityId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Suspend user account
   */
  async _suspendAccount(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          accountStatus: "suspended",
          suspendedAt: new Date(),
          suspendedReason: "Suspended by automation rule",
        },
        { new: true }
      );

      return {
        status: "success",
        message: "Account suspended",
        userId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Notify user
   */
  async _notifyUser(userId, parameters = {}) {
    try {
      const channels = parameters.channels || ["in_app", "sms"];

      // TODO: Implement notification service integration
      // Send via email, SMS, in-app notification

      return {
        status: "success",
        message: "User notified",
        channels,
        userId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Escalate to analyst
   */
  async _escalateToAnalyst(caseOrUserId) {
    try {
      // Create or update case for analyst review
      return {
        status: "success",
        message: "Escalated to analyst team",
        entityId: caseOrUserId,
      };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }

  /**
   * Get active rules
   */
  async getActiveRules() {
    try {
      const rules = await AutomationRule.find({ isActive: true }).sort({
        priority: -1,
      });
      return rules;
    } catch (error) {
      console.error("Error getting active rules:", error);
      throw error;
    }
  }

  /**
   * Get rule execution history
   */
  async getRuleExecutionHistory(ruleId, limit = 100) {
    try {
      const rule = await AutomationRule.findById(ruleId);
      if (!rule) throw new Error("Rule not found");

      return {
        ruleId,
        ruleName: rule.name,
        totalExecutions: rule.executionStats.totalExecutions,
        successfulExecutions: rule.executionStats.successfulExecutions,
        lastExecuted: rule.executionStats.lastExecutedAt,
      };
    } catch (error) {
      console.error("Error getting rule history:", error);
      throw error;
    }
  }

  /**
   * Disable/enable rule
   */
  async toggleRule(ruleId, enabled) {
    try {
      const rule = await AutomationRule.findByIdAndUpdate(
        ruleId,
        { isActive: enabled },
        { new: true }
      );

      return rule;
    } catch (error) {
      console.error("Error toggling rule:", error);
      throw error;
    }
  }
}

module.exports = AutomationEngine;
