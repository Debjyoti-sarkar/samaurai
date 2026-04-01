/**
 * Models Index
 * Export all database models
 */

const UserBehaviorProfile = require('./UserBehavior');
const Transaction = require('./Transaction');
const BehaviorEvent = require('./BehaviorEvent');
const FraudAlert = require('./FraudAlert');

module.exports = {
  UserBehaviorProfile,
  Transaction,
  BehaviorEvent,
  FraudAlert
};
