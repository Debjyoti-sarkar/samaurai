/**
 * RBAC Middleware - Role-Based Access Control
 * Enforces permission checks based on user roles
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const ROLE_PERMISSIONS = {
  admin: [
    "view_all_cases",
    "manage_users",
    "manage_rules",
    "view_analytics",
    "export_data",
    "manage_alerts",
  ],
  analyst: [
    "view_cases",
    "update_cases",
    "view_alerts",
    "manage_alerts",
    "create_cases",
  ],
  user: ["view_own_profile", "view_own_transactions", "view_own_alerts"],
  system: ["full_access"],
};

/**
 * Middleware to check authentication
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  });
};

/**
 * Middleware to check specific role
 */
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.role === "system") {
        return next(); // system role has all access
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: `This action requires one of roles: ${allowedRoles.join(
            ", "
          )}`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

/**
 * Middleware to check specific permission
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userPermissions = [
        ...ROLE_PERMISSIONS[user.role],
        ...(user.permissions || []),
      ];

      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          error: `Permission denied: ${permission}`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

/**
 * Middleware to log access
 */
const auditLog = (action) => {
  return (req, res, next) => {
    // Log the access attempt
    console.log(
      `[AUDIT] ${action} - User: ${req.userId}, Role: ${req.userRole}, IP: ${req.ip}`
    );
    next();
  };
};

/**
 * Helper to get user permissions
 */
const getUserPermissions = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return [];

    return [...(ROLE_PERMISSIONS[user.role] || []), ...(user.permissions || [])];
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  auditLog,
  getUserPermissions,
  ROLE_PERMISSIONS,
};
