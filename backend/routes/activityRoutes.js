const express = require("express");
const router = express.Router();
const {
  getUserActivityLogs,
  getSecurityAlerts,
} = require("../services/activityLogger");
const auth = require("../middleware/auth");

// @route   GET /api/activity
// @desc    Get user activity logs
router.get("/", auth, async (req, res) => {
  try {
    const { activityType, startDate, endDate, limit } = req.query;

    const result = await getUserActivityLogs(req.user.id, {
      activityType,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 100,
    });

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/activity/security-alerts
// @desc    Get security alerts
router.get("/security-alerts", auth, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const result = await getSecurityAlerts(req.user.id, parseInt(days));

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
