/**
 * Intelligence API Routes
 * Comprehensive routes for risk, events, cases, and automation
 */

const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  requireRole,
  requirePermission,
  auditLog,
} = require("../middleware/rbac");

// Import engines and services
const RiskScoringEngine = require("../engines/risk-engine/RiskScoringEngine");
const EventCorrelationEngine = require("../engines/event-engine/EventCorrelationEngine");
const GraphEngine = require("../engines/graph-engine/GraphEngine");
const AutomationEngine = require("../engines/automation-engine/AutomationEngine");
const caseManagementService = require("../services/caseManagementService");

// Initialize engines
const riskEngine = new RiskScoringEngine();
const eventEngine = new EventCorrelationEngine();
const graphEngine = new GraphEngine();
const automationEngine = new AutomationEngine(eventEngine, riskEngine);

// ============ TEST ENDPOINT (Development) ============
/**
 * GET /api/intelligence/test
 * Test endpoint to verify API is working (no auth required)
 */
router.get("/test", (req, res) => {
  res.json({
    status: "Intelligence Platform API is working",
    engines: {
      risk: "operational",
      events: "operational",
      graph: "operational",
      automation: "operational",
    },
    timestamp: new Date(),
  });
});

// ============ RISK EVALUATION ENDPOINTS ============

/**
 * POST /api/intelligence/risk/evaluate-transaction
 * Evaluate risk for a transaction
 */
router.post(
  "/risk/evaluate-transaction",
  authenticateToken,
  requirePermission("manage_alerts"),
  auditLog("evaluate_transaction_risk"),
  async (req, res) => {
    try {
      const { transactionId, transaction } = req.body;

      if (!transactionId || !transaction) {
        return res
          .status(400)
          .json({ error: "transactionId and transaction data required" });
      }

      const assessment = await riskEngine.evaluateTransactionRisk(
        transactionId,
        transaction
      );

      res.json({
        success: true,
        assessment,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/intelligence/risk/evaluate-user
 * Evaluate risk for a user
 */
router.post(
  "/risk/evaluate-user",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("evaluate_user_risk"),
  async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const assessment = await riskEngine.evaluateUserRisk(userId);

      res.json({
        success: true,
        assessment,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/risk/assessment/:assessmentId
 * Get a specific risk assessment
 */
router.get(
  "/risk/assessment/:assessmentId",
  authenticateToken,
  requirePermission("view_cases"),
  async (req, res) => {
    try {
      const { assessmentId } = req.params;

      const RiskAssessment = require("../models/RiskAssessment");
      const assessment = await RiskAssessment.findById(assessmentId);

      if (!assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }

      res.json(assessment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ============ EVENT TRACKING ENDPOINTS ============

/**
 * POST /api/intelligence/events/create
 * Create a new event
 */
router.post(
  "/events/create",
  authenticateToken,
  auditLog("create_event"),
  async (req, res) => {
    try {
      const eventData = req.body;

      const event = await eventEngine.createEvent(eventData);

      res.status(201).json({
        success: true,
        event,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/events/user/:userId
 * Get events for a user
 */
router.get(
  "/events/user/:userId",
  authenticateToken,
  requirePermission("view_cases"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const Event = require("../models/Event");
      const events = await Event.find({ userId })
        .sort({ timestamp: -1 })
        .limit(100);

      res.json({
        success: true,
        count: events.length,
        events,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/intelligence/events/correlate/:userId
 * Correlate events for a user
 */
router.post(
  "/events/correlate/:userId",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("correlate_events"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { timeWindowHours = 24 } = req.body;

      const correlations = await eventEngine.correlateUserEvents(
        userId,
        timeWindowHours
      );

      res.json({
        success: true,
        correlationCount: correlations.length,
        correlations,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/events/patterns
 * Detect suspicious patterns
 */
router.get(
  "/events/patterns",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("detect_patterns"),
  async (req, res) => {
    try {
      const patterns = await eventEngine.detectSuspiciousPatterns();

      res.json({
        success: true,
        patternCount: patterns.length,
        patterns,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ============ CASE MANAGEMENT ENDPOINTS ============

/**
 * POST /api/intelligence/cases/create
 * Create a new case
 */
router.post(
  "/cases/create",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("create_case"),
  async (req, res) => {
    try {
      const caseData = req.body;
      const caseRecord = await caseManagementService.createCase(caseData);

      res.status(201).json({
        success: true,
        case: caseRecord,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/cases/:caseId
 * Get case details
 */
router.get(
  "/cases/:caseId",
  authenticateToken,
  requirePermission("view_cases"),
  async (req, res) => {
    try {
      const { caseId } = req.params;
      const caseRecord = await caseManagementService.getCaseDetails(caseId);

      if (!caseRecord) {
        return res.status(404).json({ error: "Case not found" });
      }

      res.json(caseRecord);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/intelligence/cases/:caseId/status
 * Update case status
 */
router.put(
  "/cases/:caseId/status",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("update_case_status"),
  async (req, res) => {
    try {
      const { caseId } = req.params;
      const { status, notes } = req.body;

      const caseRecord = await caseManagementService.updateCaseStatus(
        caseId,
        status,
        notes
      );

      res.json({
        success: true,
        case: caseRecord,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/cases
 * Get cases by status
 */
router.get(
  "/cases",
  authenticateToken,
  requirePermission("view_cases"),
  async (req, res) => {
    try {
      const { status = "open" } = req.query;
      const cases = await caseManagementService.getCasesByStatus(status);

      res.json({
        success: true,
        count: cases.length,
        cases,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/intelligence/cases/:caseId/evidence
 * Add evidence to case
 */
router.post(
  "/cases/:caseId/evidence",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("add_case_evidence"),
  async (req, res) => {
    try {
      const { caseId } = req.params;
      const { type, description, sourceEventId } = req.body;

      const caseRecord = await caseManagementService.addEvidence(caseId, {
        type,
        description,
        sourceEventId,
      });

      res.json({
        success: true,
        case: caseRecord,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ============ GRAPH/RELATIONSHIP ENDPOINTS ============

/**
 * POST /api/intelligence/graph/create-relationship
 * Create entity relationship
 */
router.post(
  "/graph/create-relationship",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("create_relationship"),
  async (req, res) => {
    try {
      const { sourceEntity, relationshipType, targetEntity, context } =
        req.body;

      const relationship = await graphEngine.createRelationship(
        sourceEntity,
        relationshipType,
        targetEntity,
        context
      );

      res.json({
        success: true,
        relationship,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/graph/user/:userId/devices
 * Get devices used by user
 */
router.get(
  "/graph/user/:userId/devices",
  authenticateToken,
  requirePermission("view_cases"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const devices = await graphEngine.getUserDevices(userId);

      res.json({
        success: true,
        devices,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/graph/device/:deviceId/users
 * Get users who used a device
 */
router.get(
  "/graph/device/:deviceId/users",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const users = await graphEngine.getDeviceUsers(deviceId);

      res.json({
        success: true,
        users,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/graph/clusters
 * Find suspicious clusters
 */
router.get(
  "/graph/clusters",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  async (req, res) => {
    try {
      const clusters = await graphEngine.findSuspiciousClusters();

      res.json({
        success: true,
        clusterCount: clusters.length,
        clusters,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/graph/stats
 * Get graph statistics
 */
router.get(
  "/graph/stats",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  async (req, res) => {
    try {
      const stats = await graphEngine.getGraphStatistics();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ============ AUTOMATION ENDPOINTS ============

/**
 * POST /api/intelligence/automation/rules
 * Create an automation rule
 */
router.post(
  "/automation/rules",
  authenticateToken,
  requireRole(["admin"]),
  auditLog("create_automation_rule"),
  async (req, res) => {
    try {
      const ruleData = req.body;
      const rule = await automationEngine.createRule(ruleData);

      res.status(201).json({
        success: true,
        rule,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/intelligence/automation/rules
 * Get active rules
 */
router.get(
  "/automation/rules",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  async (req, res) => {
    try {
      const rules = await automationEngine.getActiveRules();

      res.json({
        success: true,
        count: rules.length,
        rules,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/intelligence/automation/evaluate
 * Manually evaluate and execute rules
 */
router.post(
  "/automation/evaluate",
  authenticateToken,
  requireRole(["admin", "analyst"]),
  auditLog("evaluate_automation"),
  async (req, res) => {
    try {
      const triggerData = req.body;
      const actions = await automationEngine.evaluateAndExecuteRules(
        triggerData
      );

      res.json({
        success: true,
        actionsExecuted: actions.length,
        actions,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
