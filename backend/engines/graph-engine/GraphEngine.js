/**
 * Graph Engine - Manages entity relationships for Knowledge Graph
 * Tracks: users → devices, users → transactions, devices → transactions, etc.
 */

const EntityRelationship = require("../../models/EntityRelationship");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const { v4: uuidv4 } = require("uuid");

class GraphEngine {
  /**
   * Create or update a relationship between entities
   */
  async createRelationship(sourceEntity, relationshipType, targetEntity, context = {}) {
    try {
      const relationshipId = `rel-${uuidv4()}`;

      // Check if relationship already exists
      let relationship = await EntityRelationship.findOne({
        "sourceEntity.id": sourceEntity.id,
        relationshipType,
        "targetEntity.id": targetEntity.id,
      });

      if (relationship) {
        // Update existing relationship
        relationship.frequency = (relationship.context?.frequency || 0) + 1;
        relationship.lastObserved = new Date();
        relationship.context = { ...relationship.context, ...context };
        await relationship.save();
        return relationship;
      }

      // Create new relationship
      relationship = new EntityRelationship({
        relationshipId,
        sourceEntity,
        relationshipType,
        targetEntity,
        strength: context.strength || 1,
        context: {
          ...context,
          frequency: 1,
        },
        firstObserved: new Date(),
        lastObserved: new Date(),
        active: true,
      });

      await relationship.save();
      return relationship;
    } catch (error) {
      console.error("Error creating relationship:", error);
      throw error;
    }
  }

  /**
   * Get all devices used by a user
   */
  async getUserDevices(userId) {
    try {
      const relationships = await EntityRelationship.find({
        "sourceEntity.id": userId,
        "sourceEntity.type": "user",
        relationshipType: "uses",
        active: true,
      });

      return relationships.map((r) => ({
        deviceId: r.targetEntity.id,
        frequency: r.context.frequency,
        lastUsed: r.lastObserved,
      }));
    } catch (error) {
      console.error("Error getting user devices:", error);
      throw error;
    }
  }

  /**
   * Get all users who used a device
   */
  async getDeviceUsers(deviceId) {
    try {
      const relationships = await EntityRelationship.find({
        "targetEntity.id": deviceId,
        "targetEntity.type": "device",
        relationshipType: "uses",
        active: true,
      });

      return relationships.map((r) => ({
        userId: r.sourceEntity.id,
        frequency: r.context.frequency,
        lastUsed: r.lastObserved,
      }));
    } catch (error) {
      console.error("Error getting device users:", error);
      throw error;
    }
  }

  /**
   * Get all transactions for a user
   */
  async getUserTransactions(userId) {
    try {
      const relationships = await EntityRelationship.find({
        "sourceEntity.id": userId,
        "sourceEntity.type": "user",
        relationshipType: "performs",
        active: true,
      });

      return relationships.map((r) => ({
        transactionId: r.targetEntity.id,
        timestamp: r.lastObserved,
      }));
    } catch (error) {
      console.error("Error getting user transactions:", error);
      throw error;
    }
  }

  /**
   * Check if device is shared across multiple users (suspicious pattern)
   */
  async isDeviceShared(deviceId) {
    try {
      const users = await EntityRelationship.find({
        "targetEntity.id": deviceId,
        relationshipType: "uses",
        active: true,
      }).distinct("sourceEntity.id");

      return {
        isShared: users.length > 1,
        userCount: users.length,
        userIds: users,
      };
    } catch (error) {
      console.error("Error checking device sharing:", error);
      throw error;
    }
  }

  /**
   * Get related users (connected through devices or transactions)
   */
  async getRelatedUsers(userId, depth = 1) {
    try {
      const relatedUsers = new Set();
      const visited = new Set([userId]);
      const queue = [{ id: userId, depth: 0 }];

      while (queue.length > 0) {
        const current = queue.shift();

        if (current.depth >= depth) continue;

        // Find relationships from current user
        const outgoing = await EntityRelationship.find({
          "sourceEntity.id": current.id,
          active: true,
        });

        // Find relationships to current user
        const incoming = await EntityRelationship.find({
          "targetEntity.id": current.id,
          relationshipType: "uses",
          active: true,
        });

        // Process device-user connections
        for (const rel of incoming) {
          const relatedUserId = rel.sourceEntity.id;
          if (!visited.has(relatedUserId)) {
            relatedUsers.add(relatedUserId);
            visited.add(relatedUserId);
            queue.push({
              id: relatedUserId,
              depth: current.depth + 1,
            });
          }
        }
      }

      return Array.from(relatedUsers);
    } catch (error) {
      console.error("Error getting related users:", error);
      throw error;
    }
  }

  /**
   * Flag a relationship as suspicious
   */
  async flagRelationship(relationshipId, reason) {
    try {
      const relationship = await EntityRelationship.findByIdAndUpdate(
        relationshipId,
        {
          flagged: true,
          riskReason: reason,
        },
        { new: true }
      );

      return relationship;
    } catch (error) {
      console.error("Error flagging relationship:", error);
      throw error;
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics() {
    try {
      const stats = {
        totalRelationships: await EntityRelationship.countDocuments(),
        relationshipsByType: await EntityRelationship.aggregate([
          {
            $group: {
              _id: "$relationshipType",
              count: { $sum: 1 },
            },
          },
        ]),
        flaggedRelationships: await EntityRelationship.countDocuments({
          flagged: true,
        }),
        totalEntities: {
          users: await EntityRelationship.distinct("sourceEntity.id", {
            "sourceEntity.type": "user",
          }).then((arr) => arr.length),
          devices: await EntityRelationship.distinct("targetEntity.id", {
            "targetEntity.type": "device",
          }).then((arr) => arr.length),
          transactions: await EntityRelationship.distinct("targetEntity.id", {
            "targetEntity.type": "transaction",
          }).then((arr) => arr.length),
        },
      };

      return stats;
    } catch (error) {
      console.error("Error getting graph statistics:", error);
      throw error;
    }
  }

  /**
   * Find suspicious clusters (highly connected subgraphs)
   */
  async findSuspiciousClusters() {
    try {
      // Find devices used by multiple users
      const deviceClusters = await EntityRelationship.aggregate([
        {
          $match: {
            relationshipType: "uses",
            active: true,
          },
        },
        {
          $group: {
            _id: "$targetEntity.id",
            users: { $addToSet: "$sourceEntity.id" },
            relationshipCount: { $sum: 1 },
          },
        },
        {
          $match: {
            "users.1": { $exists: true }, // More than one user
          },
        },
        {
          $sort: { relationshipCount: -1 },
        },
      ]);

      const clusters = [];
      for (const cluster of deviceClusters) {
        clusters.push({
          type: "device_sharing",
          entityId: cluster._id,
          entityType: "device",
          involvedUsers: cluster.users,
          severity:
            cluster.users.length > 5
              ? "critical"
              : cluster.users.length > 2
              ? "high"
              : "medium",
          description: `Device shared by ${cluster.users.length} users`,
        });
      }

      return clusters;
    } catch (error) {
      console.error("Error finding suspicious clusters:", error);
      throw error;
    }
  }

  /**
   * Get shortest path between two entities
   */
  async getShortestPath(sourceId, targetId) {
    try {
      // BFS to find shortest path
      const visited = new Set();
      const queue = [{ id: sourceId, path: [sourceId] }];

      while (queue.length > 0) {
        const current = queue.shift();

        if (current.id === targetId) {
          return current.path;
        }

        if (visited.has(current.id)) continue;
        visited.add(current.id);

        // Find connected entities
        const relationships = await EntityRelationship.find({
          $or: [
            { "sourceEntity.id": current.id },
            { "targetEntity.id": current.id },
          ],
          active: true,
        });

        for (const rel of relationships) {
          const nextId =
            rel.sourceEntity.id === current.id
              ? rel.targetEntity.id
              : rel.sourceEntity.id;

          if (!visited.has(nextId)) {
            queue.push({
              id: nextId,
              path: [...current.path, nextId],
            });
          }
        }
      }

      return null; // No path found
    } catch (error) {
      console.error("Error finding shortest path:", error);
      throw error;
    }
  }
}

module.exports = GraphEngine;
