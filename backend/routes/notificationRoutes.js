const express = require("express");
const router = express.Router();
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../services/notificationService");
const auth = require("../middleware/auth");

// @route   GET /api/notifications
// @desc    Get user notifications
router.get("/", auth, async (req, res) => {
  try {
    const { type, unreadOnly, limit } = req.query;

    const result = await getUserNotifications(req.user.id, {
      type,
      unreadOnly: unreadOnly === "true",
      limit: limit ? parseInt(limit) : 50,
    });

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
router.put("/:id/read", auth, async (req, res) => {
  try {
    const result = await markAsRead(req.params.id, req.user.id);

    if (!result.success) {
      return res.status(404).json({ msg: result.error });
    }

    res.json(result.notification);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
router.put("/read-all", auth, async (req, res) => {
  try {
    const result = await markAllAsRead(req.user.id);

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await deleteNotification(req.params.id, req.user.id);

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
