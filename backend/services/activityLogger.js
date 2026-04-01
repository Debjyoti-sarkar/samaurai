const ActivityLog = require("../models/ActivityLog");

/**
 * Activity Logger Service
 * Tracks user activities and security events
 */

async function logActivity(activityData) {
  try {
    const log = new ActivityLog(activityData);
    await log.save();
    
    return {
      success: true,
      log,
    };
  } catch (error) {
    console.error("Activity Logging Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getUserActivityLogs(userId, filters = {}) {
  try {
    const query = { userId };
    
    if (filters.activityType) {
      query.activityType = filters.activityType;
    }
    
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    const logs = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 100);

    return {
      success: true,
      logs,
      count: logs.length,
    };
  } catch (error) {
    console.error("Get Activity Logs Error:", error);
    return {
      success: false,
      error: error.message,
      logs: [],
    };
  }
}

async function logLogin(userId, success, metadata = {}) {
  return await logActivity({
    userId,
    activityType: "login",
    description: success ? "User logged in successfully" : "Login attempt failed",
    success,
    ipAddress: metadata.ipAddress,
    deviceInfo: metadata.deviceInfo,
    location: metadata.location,
    errorMessage: metadata.errorMessage,
  });
}

async function logTransaction(userId, transactionId, success, metadata = {}) {
  return await logActivity({
    userId,
    activityType: "transaction",
    description: `Transaction ${transactionId} ${success ? "completed" : "failed"}`,
    success,
    metadata: {
      transactionId,
      ...metadata,
    },
  });
}

async function logPinChange(userId, success, metadata = {}) {
  return await logActivity({
    userId,
    activityType: "pin_change",
    description: success ? "PIN changed successfully" : "PIN change failed",
    success,
    metadata,
  });
}

async function logBiometricAuth(userId, success, metadata = {}) {
  return await logActivity({
    userId,
    activityType: "biometric_auth",
    description: success ? "Biometric authentication successful" : "Biometric authentication failed",
    success,
    metadata,
  });
}

async function logSecurityEvent(userId, eventType, details) {
  return await logActivity({
    userId,
    activityType: "settings_change",
    description: `Security event: ${eventType}`,
    success: true,
    metadata: {
      eventType,
      ...details,
    },
  });
}

async function getSecurityAlerts(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const suspiciousActivities = await ActivityLog.find({
      userId,
      success: false,
      timestamp: { $gte: startDate },
    }).sort({ timestamp: -1 });

    return {
      success: true,
      alerts: suspiciousActivities,
      count: suspiciousActivities.length,
    };
  } catch (error) {
    console.error("Get Security Alerts Error:", error);
    return {
      success: false,
      error: error.message,
      alerts: [],
    };
  }
}

module.exports = {
  logActivity,
  getUserActivityLogs,
  logLogin,
  logTransaction,
  logPinChange,
  logBiometricAuth,
  logSecurityEvent,
  getSecurityAlerts,
};
