const mongoose = require("mongoose");

/**
 * EntityRelationship Model - Knowledge Graph: relationships between entities
 * Example: User X uses Device Y, Device Y performed Transaction Z, etc.
 */
const EntityRelationshipSchema = new mongoose.Schema({
  relationshipId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },

  // Source entity
  sourceEntity: {
    type: {
      type: String,
      enum: ["user", "device", "transaction", "session", "account"],
    },
    id: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String
  },

  // Relationship type
  relationshipType: {
    type: String,
    enum: [
      "uses",           // user-uses-device
      "performs",       // user-performs-transaction
      "receives",       // user-receives-transaction
      "owns",           // user-owns-account
      "initiated",      // session-initiated-on-device
      "generates",      // device-generates-event
      "linked_to",      // device-linked-to-user
      "shared_with",    // account-shared-with-user
    ],
    required: true,
  },

  // Target entity
  targetEntity: {
    type: {
      type: String,
      enum: ["user", "device", "transaction", "session", "account"],
    },
    id: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String
  },

  // Relationship strength/confidence
  strength: {
    type: Number,
    min: 0,
    max: 1, // 0-1 confidence score
    default: 1,
  },

  // Context/metadata
  context: {
    transactionId: mongoose.Schema.Types.ObjectId,
    sessionId: mongoose.Schema.Types.ObjectId,
    location: String,
    ipAddress: String,
    frequency: Number, // how many times this relationship has been observed
  },

  // Temporal info
  firstObserved: {
    type: Date,
    default: Date.now,
  },
  lastObserved: {
    type: Date,
    default: Date.now,
  },

  // Risk annotations
  flagged: {
    type: Boolean,
    default: false,
  },
  riskReason: String,

  // Status
  active: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for graph queries
EntityRelationshipSchema.index({ "sourceEntity.id": 1, relationshipType: 1 });
EntityRelationshipSchema.index({ "targetEntity.id": 1, relationshipType: 1 });
EntityRelationshipSchema.index({ flagged: 1, active: 1 });

module.exports = mongoose.model("EntityRelationship", EntityRelationshipSchema);
