/**
 * Notification Service
 *
 * Handles fraud alert notifications with:
 * - Rich notifications with actions
 * - Deep linking to FraudAlertScreen
 * - Notification categories with quick actions
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FraudAnalysis, SMSFraudRecord } from './RealTimeSMSMonitor';

// Notification categories
const NOTIFICATION_CATEGORIES = {
  FRAUD_ALERT: 'fraud_alert',
  WARNING: 'sms_warning',
  INFO: 'sms_info'
};

// Store for pending notification data
const NOTIFICATION_DATA_KEY = '@kavach_notification_data';

class NotificationService {
  private isInitialized: boolean = false;
  private navigationRef: any = null;

  async initialize() {
    if (this.isInitialized) return;

    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async (notification): Promise<Notifications.NotificationBehavior> => {
        const data = notification.request.content.data as any;
        const riskLevel = data?.riskLevel || 'info';

        return {
          shouldShowAlert: true,
          shouldPlaySound: riskLevel === 'danger',
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });

    // Setup notification channels for Android
    if (Platform.OS === 'android') {
      await this.setupAndroidChannels();
    }

    // Setup notification categories with actions
    await this.setupCategories();

    // Listen for notification interactions
    this.setupNotificationListeners();

    this.isInitialized = true;
    console.log('[NotificationService] Initialized');
  }

  private async setupAndroidChannels() {
    // High priority fraud alerts channel
    await Notifications.setNotificationChannelAsync('fraud-alerts', {
      name: 'Fraud Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#FF0000',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });

    // Warning notifications channel
    await Notifications.setNotificationChannelAsync('sms-warnings', {
      name: 'SMS Warnings',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 100, 300],
      lightColor: '#FFA500',
      sound: 'default',
    });

    // Info notifications channel
    await Notifications.setNotificationChannelAsync('sms-info', {
      name: 'SMS Information',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  private async setupCategories() {
    // Category for fraud alerts with quick actions
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.FRAUD_ALERT, [
      {
        identifier: 'view_details',
        buttonTitle: 'View Details',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'block_sender',
        buttonTitle: 'Block Sender',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    // Category for warnings
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.WARNING, [
      {
        identifier: 'view_details',
        buttonTitle: 'Review',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
  }

  private setupNotificationListeners() {
    // Handle notification tap (foreground)
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { notification, actionIdentifier } = response;
      const data = notification.request.content.data as any;

      console.log('[NotificationService] Response received:', actionIdentifier, data);

      switch (actionIdentifier) {
        case 'view_details':
        case Notifications.DEFAULT_ACTION_IDENTIFIER:
          // Navigate to FraudAlertScreen
          await this.navigateToAlert(data);
          break;

        case 'block_sender':
          // Block sender in background
          await this.handleBlockSender(data);
          break;

        case 'dismiss':
          // Just dismiss
          await this.handleDismiss(data);
          break;
      }
    });

    // Handle notification received while app is foregrounded
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('[NotificationService] Notification received in foreground');
      // Could show in-app alert here
    });
  }

  /**
   * Set navigation reference for deep linking
   */
  setNavigationRef(ref: any) {
    this.navigationRef = ref;
  }

  /**
   * Navigate to FraudAlertScreen with data
   */
  private async navigateToAlert(data: any) {
    // Store notification data for retrieval
    await AsyncStorage.setItem(NOTIFICATION_DATA_KEY, JSON.stringify(data));

    if (this.navigationRef?.current) {
      this.navigationRef.current.navigate('FraudAlert', {
        recordId: data.recordId,
        sms: data.sms,
        analysis: data.analysis
      });
    } else {
      // Use deep linking as fallback
      const url = Linking.createURL('fraud-alert', {
        queryParams: {
          recordId: data.recordId
        }
      });
      await Linking.openURL(url);
    }
  }

  /**
   * Handle block sender action from notification
   */
  private async handleBlockSender(data: any) {
    if (data.sender) {
      const { realTimeSMSMonitor } = require('./RealTimeSMSMonitor');
      await realTimeSMSMonitor.blockSender(data.sender);

      if (data.recordId) {
        await realTimeSMSMonitor.updateRecordAction(data.recordId, 'blocked');
      }

      // Show confirmation notification
      await this.showSimpleNotification(
        'Sender Blocked',
        `${data.sender} has been blocked. You won't receive fraud alerts from this sender.`,
        'info'
      );
    }
  }

  /**
   * Handle dismiss action from notification
   */
  private async handleDismiss(data: any) {
    if (data.recordId) {
      const { realTimeSMSMonitor } = require('./RealTimeSMSMonitor');
      await realTimeSMSMonitor.updateRecordAction(data.recordId, 'dismissed');
    }
  }

  /**
   * Show fraud alert notification
   */
  async showFraudAlert(record: SMSFraudRecord): Promise<string> {
    const { sms, analysis } = record;
    const isDanger = analysis.riskLevel === 'danger';

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: isDanger ? '🚨 FRAUD ALERT' : '⚠️ Suspicious Message',
        subtitle: `From: ${sms.sender}`,
        body: this.truncateMessage(sms.body, 100),
        data: {
          recordId: record.id,
          sender: sms.sender,
          riskLevel: analysis.riskLevel,
          riskScore: analysis.riskScore,
          sms: {
            sender: sms.sender,
            body: sms.body,
            timestamp: sms.timestamp
          },
          analysis: {
            riskScore: analysis.riskScore,
            riskLevel: analysis.riskLevel,
            reasons: analysis.reasons,
            urlsFound: analysis.urlsFound,
            otpDetected: analysis.otpDetected
          }
        },
        categoryIdentifier: isDanger
          ? NOTIFICATION_CATEGORIES.FRAUD_ALERT
          : NOTIFICATION_CATEGORIES.WARNING,
        sound: 'default',
        priority: isDanger ? 'max' : 'high',
        badge: 1,
        ...(Platform.OS === 'android' && {
          channelId: isDanger ? 'fraud-alerts' : 'sms-warnings',
          color: isDanger ? '#FF0000' : '#FFA500',
          sticky: isDanger,
        }),
      },
      trigger: null, // Immediate
    });

    console.log('[NotificationService] Fraud alert shown:', notificationId);
    return notificationId;
  }

  /**
   * Show rich fraud notification with custom layout
   */
  async showRichFraudAlert(record: SMSFraudRecord): Promise<string> {
    const { sms, analysis } = record;

    // Build detailed body
    const indicators = analysis.reasons.slice(0, 3).map(r => `• ${r}`).join('\n');
    const body = `Risk: ${analysis.riskScore}% ${analysis.riskLevel.toUpperCase()}\n\n"${this.truncateMessage(sms.body, 80)}"\n\n${indicators}`;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: analysis.riskLevel === 'danger'
          ? '🚨 FRAUD DETECTED!'
          : '⚠️ Suspicious SMS Detected',
        body,
        data: {
          recordId: record.id,
          sender: sms.sender,
          riskLevel: analysis.riskLevel,
          riskScore: analysis.riskScore,
          sms: {
            sender: sms.sender,
            body: sms.body,
            timestamp: sms.timestamp
          },
          analysis
        },
        categoryIdentifier: NOTIFICATION_CATEGORIES.FRAUD_ALERT,
        sound: 'default',
        priority: 'max',
        badge: 1,
        ...(Platform.OS === 'android' && {
          channelId: 'fraud-alerts',
          color: '#FF0000',
          sticky: true,
          style: {
            type: 'bigtext',
            text: body
          }
        }),
      },
      trigger: null,
    });

    return notificationId;
  }

  /**
   * Show simple notification
   */
  async showSimpleNotification(
    title: string,
    body: string,
    type: 'info' | 'warning' | 'success' = 'info'
  ): Promise<string> {
    const colors = {
      info: '#007AFF',
      warning: '#FFA500',
      success: '#34C759'
    };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: type === 'warning' ? 'default' : undefined,
        ...(Platform.OS === 'android' && {
          channelId: 'sms-info',
          color: colors[type],
        }),
      },
      trigger: null,
    });

    return notificationId;
  }

  /**
   * Cancel a notification
   */
  async cancelNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear badge
   */
  async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Get pending notification data (for deep linking)
   */
  async getPendingNotificationData(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATION_DATA_KEY);
      if (data) {
        await AsyncStorage.removeItem(NOTIFICATION_DATA_KEY);
        return JSON.parse(data);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Truncate message for notification preview
   */
  private truncateMessage(message: string, maxLength: number): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }
}

// Export singleton
export const notificationService = new NotificationService();
export default notificationService;
