/**
 * NexaSafe Dashboard Sync Service
 * Syncs behavioral analytics data to the web dashboard in real-time
 */

import { Platform } from 'react-native';
import { nexaSafeTracker, SessionData, BehaviorLog } from './NexaSafeTrackerManager';

// Dashboard server URL - change this to your server address
const DASHBOARD_URL = Platform.select({
  android: 'http://10.0.2.2:3001', // Android emulator localhost
  ios: 'http://localhost:3001',
  default: 'http://localhost:3001'
});

class NexaSafeDashboardSync {
  private static instance: NexaSafeDashboardSync;
  private syncInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;
  private lastSyncTime: number = 0;
  private syncIntervalMs: number = 2000; // Sync every 2 seconds

  private constructor() {}

  static getInstance(): NexaSafeDashboardSync {
    if (!NexaSafeDashboardSync.instance) {
      NexaSafeDashboardSync.instance = new NexaSafeDashboardSync();
    }
    return NexaSafeDashboardSync.instance;
  }

  /**
   * Enable real-time sync to dashboard
   */
  enable(serverUrl?: string): void {
    if (serverUrl) {
      // Allow custom server URL
      console.log(`NexaSafe Dashboard: Using custom server ${serverUrl}`);
    }
    this.isEnabled = true;
    this.startSync();
    console.log('NexaSafe Dashboard sync enabled');
  }

  /**
   * Disable sync
   */
  disable(): void {
    this.isEnabled = false;
    this.stopSync();
    console.log('NexaSafe Dashboard sync disabled');
  }

  /**
   * Start periodic sync
   */
  private startSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.syncCurrentState();
    }, this.syncIntervalMs);
  }

  /**
   * Stop periodic sync
   */
  private stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync current NexaSafe state to dashboard
   */
  private async syncCurrentState(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const trustScore = nexaSafeTracker.getTrustScore();
      const behaviorLogs = nexaSafeTracker.getBehaviorLogs();
      const appliedPenalties = nexaSafeTracker.getAppliedPenalties();
      const screenRecordingDetected = nexaSafeTracker.isScreenRecordingActive();

      const syncData = {
        trustScore,
        riskLevel: this.getRiskLevel(trustScore),
        sessionActive: true,
        behaviorLogs,
        appliedPenalties,
        screenRecordingDetected,
        lastSync: new Date().toISOString()
      };

      await fetch(`${DASHBOARD_URL}/api/nexasafe/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncData)
      });

      this.lastSyncTime = Date.now();
    } catch (error) {
      // Silent fail - dashboard might not be running
      console.debug('Dashboard sync failed (server may be offline)');
    }
  }

  /**
   * Send behavior detection to dashboard immediately
   */
  async sendBehavior(behaviorId: number, extraData?: any): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${DASHBOARD_URL}/api/nexasafe/behavior`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ behaviorId, extraData })
      });
    } catch (error) {
      console.debug('Failed to send behavior to dashboard');
    }
  }

  /**
   * Send session start notification
   */
  async sendSessionStart(deviceInfo?: any): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${DASHBOARD_URL}/api/nexasafe/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deviceInfo })
      });
    } catch (error) {
      console.debug('Failed to notify session start');
    }
  }

  /**
   * Send session end notification
   */
  async sendSessionEnd(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${DASHBOARD_URL}/api/nexasafe/session/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.debug('Failed to notify session end');
    }
  }

  /**
   * Send tap event
   */
  async sendTapEvent(screen: string, x: number, y: number, zone: string, durationMs?: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${DASHBOARD_URL}/api/nexasafe/tap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ screen, position: { x, y }, zone, durationMs })
      });
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Send swipe event
   */
  async sendSwipeEvent(startPos: number, endPos: number, speed: number, durationMs: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${DASHBOARD_URL}/api/nexasafe/swipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startPos, endPos, speed, durationMs })
      });
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Send screen visit
   */
  async sendScreenVisit(screen: string, duration?: number): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await fetch(`${DASHBOARD_URL}/api/nexasafe/screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ screen, duration })
      });
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Get risk level from trust score
   */
  private getRiskLevel(score: number): 'safe' | 'caution' | 'warning' | 'danger' {
    if (score >= 80) return 'safe';
    if (score >= 60) return 'caution';
    if (score >= 40) return 'warning';
    return 'danger';
  }

  /**
   * Check if sync is enabled
   */
  isEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Set custom sync interval
   */
  setSyncInterval(ms: number): void {
    this.syncIntervalMs = ms;
    if (this.isEnabled) {
      this.stopSync();
      this.startSync();
    }
  }
}

// Export singleton instance
export const dashboardSync = NexaSafeDashboardSync.getInstance();
export { NexaSafeDashboardSync };
