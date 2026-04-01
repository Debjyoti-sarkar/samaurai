const Notification = require("../models/Notification");

/**
 * Notification Service
 * Handles creation and management of user notifications
 */

async function createNotification(userId, notificationData) {
  try {
    const notification = new Notification({
      userId,
      ...notificationData,
    });

    await notification.save();
    return {
      success: true,
      notification,
    };
  } catch (error) {
    console.error("Notification Creation Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getUserNotifications(userId, filters = {}) {
  try {
    const query = { userId };
    
    if (filters.type) {
      query.type = filters.type;
    }
    
    if (filters.unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 50);

    return {
      success: true,
      notifications,
      count: notifications.length,
    };
  } catch (error) {
    console.error("Get Notifications Error:", error);
    return {
      success: false,
      error: error.message,
      notifications: [],
    };
  }
}

async function markAsRead(notificationId, userId) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true }
    );

    return {
      success: true,
      notification,
    };
  } catch (error) {
    console.error("Mark Read Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function markAllAsRead(userId) {
  try {
    await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    return {
      success: true,
      message: "All notifications marked as read",
    };
  } catch (error) {
    console.error("Mark All Read Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function deleteNotification(notificationId, userId) {
  try {
    await Notification.findOneAndDelete({ _id: notificationId, userId });

    return {
      success: true,
      message: "Notification deleted",
    };
  } catch (error) {
    console.error("Delete Notification Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper to send fraud alert notifications
async function sendFraudAlert(userId, fraudData) {
  return await createNotification(userId, {
    type: "fraud_alert",
    title: "Fraud Alert!",
    message: fraudData.message,
    priority: "urgent",
    relatedId: fraudData.relatedId,
    relatedModel: fraudData.relatedModel,
  });
}

// Helper to send transaction notifications
async function sendTransactionNotification(userId, transactionData) {
  const { type, amount, status } = transactionData;
  
  return await createNotification(userId, {
    type: "transaction",
    title: type === "receive" ? "Money Received" : "Payment Sent",
    message: `₹${amount} ${type === "receive" ? "received" : "sent"} - ${status}`,
    priority: "medium",
    relatedId: transactionData._id,
    relatedModel: "Transaction",
  });
}

// Helper to send loan notifications
async function sendLoanNotification(userId, loanData) {
  return await createNotification(userId, {
    type: "loan",
    title: "Loan Update",
    message: loanData.message,
    priority: loanData.priority || "medium",
    relatedId: loanData.loanId,
    relatedModel: "Loan",
  });
}

// Helper to send EMI reminders
async function sendEMIReminder(userId, emiData) {
  return await createNotification(userId, {
    type: "emi",
    title: "EMI Due Reminder",
    message: `EMI of ₹${emiData.amount} is due on ${emiData.dueDate}`,
    priority: "high",
    relatedId: emiData.emiId,
    relatedModel: "EMI",
  });
}

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendFraudAlert,
  sendTransactionNotification,
  sendLoanNotification,
  sendEMIReminder,
};
