/**
 * User Profiler Service
 * Builds and maintains user behavioral profiles
 */

const UserBehaviorProfile = require('../models/UserBehavior');
const Transaction = require('../models/Transaction');
const BehaviorEvent = require('../models/BehaviorEvent');

class UserProfiler {
  constructor() {
    this.profileUpdateInterval = 3600000; // 1 hour
  }

  /**
   * Get or create user profile
   */
  async getOrCreateProfile(userId, phoneNumber) {
    let profile = await UserBehaviorProfile.findOne({ userId });

    if (!profile) {
      profile = new UserBehaviorProfile({
        userId,
        phoneNumber,
        transactionPatterns: {},
        timePatterns: { hourlyDistribution: new Map(), dayDistribution: new Map() },
        recipientPatterns: { frequentRecipients: [] },
        devicePatterns: { trustedDevices: [] },
        locationPatterns: { trustedLocations: [], commonIPs: [] },
        sessionPatterns: {},
        authPatterns: {},
        riskMetrics: { riskFactors: [] }
      });
      await profile.save();
    }

    return profile;
  }

  /**
   * Update user profile with new transaction
   */
  async updateProfileWithTransaction(userId, transaction) {
    const profile = await this.getOrCreateProfile(userId, transaction.phoneNumber);

    // Update transaction patterns
    const tp = profile.transactionPatterns;
    tp.totalTransactions = (tp.totalTransactions || 0) + 1;
    tp.totalAmount = (tp.totalAmount || 0) + transaction.amount;
    tp.avgTransactionAmount = tp.totalAmount / tp.totalTransactions;
    tp.maxTransactionAmount = Math.max(tp.maxTransactionAmount || 0, transaction.amount);
    tp.minTransactionAmount = Math.min(tp.minTransactionAmount || Infinity, transaction.amount);

    // Calculate standard deviation (running calculation)
    if (tp.totalTransactions > 1) {
      const variance = await this.calculateAmountVariance(userId);
      tp.stdDevAmount = Math.sqrt(variance);
    }

    // Update time patterns
    const hour = new Date(transaction.timing?.initiatedAt || Date.now()).getHours();
    const day = new Date(transaction.timing?.initiatedAt || Date.now()).getDay();

    const hourlyDist = profile.timePatterns.hourlyDistribution || new Map();
    const currentHourCount = hourlyDist.get(String(hour)) || 0;
    hourlyDist.set(String(hour), currentHourCount + 1);
    profile.timePatterns.hourlyDistribution = hourlyDist;

    const dayDist = profile.timePatterns.dayDistribution || new Map();
    const currentDayCount = dayDist.get(String(day)) || 0;
    dayDist.set(String(day), currentDayCount + 1);
    profile.timePatterns.dayDistribution = dayDist;

    // Update preferred hours (top 5 most active)
    profile.timePatterns.preferredHours = this.getTopKeys(hourlyDist, 5);
    profile.timePatterns.preferredDays = this.getTopKeys(dayDist, 3);

    // Update recipient patterns
    if (transaction.recipient?.upiId) {
      await this.updateRecipientPattern(profile, transaction.recipient);
    }

    // Update device patterns
    if (transaction.deviceInfo?.deviceId) {
      await this.updateDevicePattern(profile, transaction.deviceInfo);
    }

    // Update location patterns
    if (transaction.locationInfo?.latitude) {
      await this.updateLocationPattern(profile, transaction.locationInfo);
    }

    profile.lastActivity = new Date();
    await profile.save();

    return profile;
  }

  /**
   * Update recipient pattern
   */
  async updateRecipientPattern(profile, recipient) {
    const existingIdx = profile.recipientPatterns.frequentRecipients.findIndex(
      r => r.upiId === recipient.upiId
    );

    if (existingIdx >= 0) {
      // Update existing recipient
      const existing = profile.recipientPatterns.frequentRecipients[existingIdx];
      existing.transactionCount += 1;
      existing.totalAmount += recipient.amount || 0;
      existing.lastTransaction = new Date();
      existing.trustScore = Math.min(100, existing.trustScore + 5);
    } else {
      // Add new recipient
      profile.recipientPatterns.frequentRecipients.push({
        upiId: recipient.upiId,
        name: recipient.name,
        transactionCount: 1,
        totalAmount: recipient.amount || 0,
        lastTransaction: new Date(),
        trustScore: 0
      });
      profile.recipientPatterns.uniqueRecipientsCount += 1;
    }

    // Sort by transaction count and keep top 50
    profile.recipientPatterns.frequentRecipients.sort(
      (a, b) => b.transactionCount - a.transactionCount
    );
    profile.recipientPatterns.frequentRecipients =
      profile.recipientPatterns.frequentRecipients.slice(0, 50);
  }

  /**
   * Update device pattern
   */
  async updateDevicePattern(profile, deviceInfo) {
    const existingIdx = profile.devicePatterns.trustedDevices.findIndex(
      d => d.deviceId === deviceInfo.deviceId
    );

    if (existingIdx >= 0) {
      // Update existing device
      const existing = profile.devicePatterns.trustedDevices[existingIdx];
      existing.lastSeen = new Date();
      existing.transactionCount += 1;
      existing.trustScore = Math.min(100, existing.trustScore + 2);
    } else {
      // Add new device
      profile.devicePatterns.trustedDevices.push({
        deviceId: deviceInfo.deviceId,
        deviceModel: deviceInfo.deviceModel,
        osVersion: deviceInfo.osVersion,
        firstSeen: new Date(),
        lastSeen: new Date(),
        transactionCount: 1,
        trustScore: 10 // Start with low trust
      });
    }

    // Set primary device (most used)
    const primaryDevice = profile.devicePatterns.trustedDevices.reduce(
      (max, d) => d.transactionCount > (max?.transactionCount || 0) ? d : max,
      null
    );
    if (primaryDevice) {
      profile.devicePatterns.primaryDevice = {
        deviceId: primaryDevice.deviceId,
        deviceModel: primaryDevice.deviceModel
      };
    }
  }

  /**
   * Update location pattern
   */
  async updateLocationPattern(profile, locationInfo) {
    const RADIUS_THRESHOLD = 5; // km

    // Check if location is near existing trusted location
    let foundNearby = false;
    for (const loc of profile.locationPatterns.trustedLocations) {
      const distance = this.calculateDistance(
        loc.latitude, loc.longitude,
        locationInfo.latitude, locationInfo.longitude
      );

      if (distance <= RADIUS_THRESHOLD) {
        loc.visitCount += 1;
        loc.lastVisit = new Date();
        loc.trustScore = Math.min(100, loc.trustScore + 3);
        foundNearby = true;
        break;
      }
    }

    if (!foundNearby && locationInfo.latitude && locationInfo.longitude) {
      // Add new location
      profile.locationPatterns.trustedLocations.push({
        latitude: locationInfo.latitude,
        longitude: locationInfo.longitude,
        radius: RADIUS_THRESHOLD,
        name: locationInfo.city || 'Unknown',
        visitCount: 1,
        lastVisit: new Date(),
        trustScore: 10
      });
    }

    // Update IP patterns
    if (locationInfo.ipAddress) {
      const ipIdx = profile.locationPatterns.commonIPs.findIndex(
        ip => ip.ip === locationInfo.ipAddress
      );

      if (ipIdx >= 0) {
        profile.locationPatterns.commonIPs[ipIdx].lastSeen = new Date();
        profile.locationPatterns.commonIPs[ipIdx].accessCount += 1;
      } else {
        profile.locationPatterns.commonIPs.push({
          ip: locationInfo.ipAddress,
          firstSeen: new Date(),
          lastSeen: new Date(),
          accessCount: 1,
          location: locationInfo.city
        });
      }

      // Keep only top 20 IPs
      profile.locationPatterns.commonIPs.sort((a, b) => b.accessCount - a.accessCount);
      profile.locationPatterns.commonIPs = profile.locationPatterns.commonIPs.slice(0, 20);
    }
  }

  /**
   * Update session patterns
   */
  async updateSessionPatterns(userId, sessionMetrics) {
    const profile = await this.getOrCreateProfile(userId);

    const sp = profile.sessionPatterns;
    const count = profile.transactionPatterns.totalTransactions || 1;

    // Running average for session duration
    sp.avgSessionDuration = (
      (sp.avgSessionDuration || 0) * (count - 1) + sessionMetrics.duration
    ) / count;

    // Running average for actions per session
    sp.avgActionsPerSession = (
      (sp.avgActionsPerSession || 0) * (count - 1) + sessionMetrics.actionCount
    ) / count;

    // Running average for time between actions
    sp.avgTimeBetweenActions = (
      (sp.avgTimeBetweenActions || 0) * (count - 1) + sessionMetrics.avgTimeBetweenActions
    ) / count;

    await profile.save();
    return profile;
  }

  /**
   * Update auth patterns
   */
  async updateAuthPatterns(userId, authEvent) {
    const profile = await this.getOrCreateProfile(userId);

    const ap = profile.authPatterns;

    if (authEvent.success) {
      ap.lastAuthMethod = authEvent.method;

      if (authEvent.method === 'biometric') {
        const totalBioAttempts = (ap.biometricAttempts || 0) + 1;
        const successfulBio = (ap.biometricSuccesses || 0) + 1;
        ap.biometricAttempts = totalBioAttempts;
        ap.biometricSuccesses = successfulBio;
        ap.biometricSuccessRate = successfulBio / totalBioAttempts;
      }
    } else {
      ap.failedAuthAttempts = (ap.failedAuthAttempts || 0) + 1;
    }

    // Calculate avg auth attempts
    const totalAuth = (ap.totalAuthAttempts || 0) + 1;
    ap.totalAuthAttempts = totalAuth;
    ap.avgAuthAttempts = totalAuth / (profile.transactionPatterns.totalTransactions || 1);

    // Determine preferred auth method
    if (ap.biometricSuccessRate > 0.7) {
      ap.preferredAuthMethod = 'biometric';
    } else if (ap.biometricSuccessRate > 0.3) {
      ap.preferredAuthMethod = 'both';
    } else {
      ap.preferredAuthMethod = 'pin';
    }

    await profile.save();
    return profile;
  }

  /**
   * Full profile rebuild from historical data
   */
  async rebuildProfile(userId, days = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all transactions
    const transactions = await Transaction.find({
      userId,
      'timing.initiatedAt': { $gte: startDate },
      status: 'success'
    }).sort({ 'timing.initiatedAt': 1 });

    const profile = await this.getOrCreateProfile(userId);

    // Reset patterns
    profile.transactionPatterns = {
      avgTransactionAmount: 0,
      maxTransactionAmount: 0,
      minTransactionAmount: Infinity,
      totalTransactions: 0,
      totalAmount: 0,
      stdDevAmount: 0
    };
    profile.timePatterns = {
      preferredHours: [],
      hourlyDistribution: new Map(),
      preferredDays: [],
      dayDistribution: new Map()
    };
    profile.recipientPatterns = {
      frequentRecipients: [],
      uniqueRecipientsCount: 0,
      newRecipientFrequency: 0
    };

    // Rebuild from transactions
    for (const tx of transactions) {
      await this.updateProfileWithTransaction(userId, tx);
    }

    // Calculate feature vector
    profile.calculateFeatureVector();
    profile.profileVersion += 1;

    await profile.save();
    return profile;
  }

  /**
   * Calculate amount variance
   */
  async calculateAmountVariance(userId) {
    const stats = await Transaction.aggregate([
      { $match: { userId, status: 'success' } },
      {
        $group: {
          _id: null,
          variance: { $stdDevPop: '$amount' }
        }
      }
    ]);

    return stats[0]?.variance ** 2 || 0;
  }

  /**
   * Get top N keys from a Map by value
   */
  getTopKeys(map, n) {
    const entries = Array.from(map.entries());
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, n).map(e => parseInt(e[0]));
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Check if recipient is trusted
   */
  async isRecipientTrusted(userId, recipientUpiId) {
    const profile = await UserBehaviorProfile.findOne({ userId });
    if (!profile) return false;

    const recipient = profile.recipientPatterns.frequentRecipients.find(
      r => r.upiId === recipientUpiId
    );

    return recipient && recipient.trustScore >= 50;
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId, deviceId) {
    const profile = await UserBehaviorProfile.findOne({ userId });
    if (!profile) return false;

    const device = profile.devicePatterns.trustedDevices.find(
      d => d.deviceId === deviceId
    );

    return device && device.trustScore >= 50;
  }

  /**
   * Check if location is trusted
   */
  async isLocationTrusted(userId, latitude, longitude) {
    const profile = await UserBehaviorProfile.findOne({ userId });
    if (!profile) return false;

    for (const loc of profile.locationPatterns.trustedLocations) {
      const distance = this.calculateDistance(
        loc.latitude, loc.longitude,
        latitude, longitude
      );

      if (distance <= loc.radius && loc.trustScore >= 50) {
        return true;
      }
    }

    return false;
  }
}

// Singleton instance
const userProfiler = new UserProfiler();

module.exports = userProfiler;
