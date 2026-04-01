/**
 * SMS Fraud Detection Dashboard
 *
 * Real-time monitoring dashboard showing:
 * - Live SMS fraud detection status
 * - Statistics and trends
 * - Recent alerts with risk levels
 * - Blocked/trusted sender management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  RefreshControl,
  FlatList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
  SlideInRight
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { useSMSMonitor } from '@/hooks/useSMSMonitor';
import { Spacing, BorderRadius, KAVACHColors } from '@/constants/theme';
import { SMSFraudRecord, FraudAnalysis } from '@/services/RealTimeSMSMonitor';

export default function SMSFraudDashboard() {
  const { theme } = useTheme();
  const {
    isMonitoring,
    isMockMode,
    hasPermissions,
    isLoading,
    error,
    stats,
    recentAlerts,
    blockedSenders,
    startMonitoring,
    stopMonitoring,
    requestPermissions,
    refreshStats,
    refreshAlerts,
    blockSender,
    dismissAlert,
    reportAlert,
    scanAllSMS
  } = useSMSMonitor({
    onFraudDetected: (record) => {
      // Show in-app alert for fraud
      Alert.alert(
        '🚨 Fraud Detected!',
        `Dangerous message from ${record.sms.sender}\n\nRisk Score: ${record.analysis.riskScore}%\n\n${record.analysis.recommendation}`,
        [
          { text: 'Block Sender', onPress: () => blockSender(record.sms.sender) },
          { text: 'Dismiss', style: 'cancel' }
        ]
      );
    }
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'alerts' | 'blocked'>('alerts');

  // Animation values
  const pulseScale = useSharedValue(1);
  const scanRotation = useSharedValue(0);

  useEffect(() => {
    if (isMonitoring) {
      pulseScale.value = withRepeat(
        withTiming(1.1, { duration: 1000 }),
        -1,
        true
      );
    } else {
      pulseScale.value = 1;
    }
  }, [isMonitoring]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }]
  }));

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${scanRotation.value}deg` }]
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshStats();
    await refreshAlerts();
    setRefreshing(false);
  }, [refreshStats, refreshAlerts]);

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      await stopMonitoring();
    } else {
      if (!hasPermissions && !isMockMode) {
        const granted = await requestPermissions();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'SMS permissions are needed to monitor messages for fraud detection.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      await startMonitoring();
    }
  };

  const handleScanAll = async () => {
    setIsScanning(true);
    scanRotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);

    try {
      const records = await scanAllSMS();
      const fraudCount = records.filter(r => r.analysis.riskLevel === 'danger').length;
      const warningCount = records.filter(r => r.analysis.riskLevel === 'warning').length;

      Alert.alert(
        'Scan Complete',
        `Scanned ${records.length} messages\n\n🚨 Fraud: ${fraudCount}\n⚠️ Warning: ${warningCount}\n✅ Safe: ${records.length - fraudCount - warningCount}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsScanning(false);
      scanRotation.value = 0;
    }
  };

  const handleAlertAction = (record: SMSFraudRecord, action: 'dismiss' | 'block' | 'report') => {
    switch (action) {
      case 'dismiss':
        dismissAlert(record.id);
        break;
      case 'block':
        blockSender(record.sms.sender);
        dismissAlert(record.id);
        break;
      case 'report':
        reportAlert(record.id);
        Alert.alert('Reported', 'This message has been reported as spam/fraud.');
        break;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'safe': return KAVACHColors.success;
      case 'warning': return KAVACHColors.warning;
      case 'danger': return KAVACHColors.sos;
      default: return theme.textSecondary;
    }
  };

  const getRiskIcon = (level: string): keyof typeof Feather.glyphMap => {
    switch (level) {
      case 'safe': return 'check-circle';
      case 'warning': return 'alert-triangle';
      case 'danger': return 'alert-octagon';
      default: return 'help-circle';
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderAlertItem = ({ item, index }: { item: SMSFraudRecord; index: number }) => (
    <Animated.View
      entering={SlideInRight.delay(index * 100).springify()}
      style={[
        styles.alertCard,
        {
          backgroundColor: theme.card,
          borderLeftColor: getRiskColor(item.analysis.riskLevel),
          borderLeftWidth: 4
        }
      ]}
    >
      <View style={styles.alertHeader}>
        <View style={[styles.riskBadge, { backgroundColor: getRiskColor(item.analysis.riskLevel) + '20' }]}>
          <Feather
            name={getRiskIcon(item.analysis.riskLevel)}
            size={16}
            color={getRiskColor(item.analysis.riskLevel)}
          />
          <ThemedText type="caption" style={{ color: getRiskColor(item.analysis.riskLevel), marginLeft: 4, fontWeight: '600' }}>
            {item.analysis.riskScore}%
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {formatTime(item.createdAt)}
        </ThemedText>
      </View>

      <View style={styles.alertContent}>
        <ThemedText type="small" style={{ fontWeight: '600', marginBottom: 4 }}>
          {item.sms.sender}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={2}>
          {item.sms.body}
        </ThemedText>
      </View>

      {item.analysis.reasons.length > 0 && (
        <View style={styles.reasonsContainer}>
          {item.analysis.reasons.slice(0, 2).map((reason, i) => (
            <View key={i} style={styles.reasonTag}>
              <Feather name="alert-circle" size={10} color={getRiskColor(item.analysis.riskLevel)} />
              <ThemedText type="caption" style={{ marginLeft: 4, fontSize: 10, color: theme.textSecondary }}>
                {reason}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      {item.userAction === 'pending' && (
        <View style={styles.alertActions}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: KAVACHColors.sos + '15' }]}
            onPress={() => handleAlertAction(item, 'block')}
          >
            <Feather name="slash" size={14} color={KAVACHColors.sos} />
            <ThemedText type="caption" style={{ color: KAVACHColors.sos, marginLeft: 4 }}>Block</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: KAVACHColors.warning + '15' }]}
            onPress={() => handleAlertAction(item, 'report')}
          >
            <Feather name="flag" size={14} color={KAVACHColors.warning} />
            <ThemedText type="caption" style={{ color: KAVACHColors.warning, marginLeft: 4 }}>Report</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.border }]}
            onPress={() => handleAlertAction(item, 'dismiss')}
          >
            <Feather name="x" size={14} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>Dismiss</ThemedText>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="shield" size={48} color={KAVACHColors.primary} />
        <ThemedText type="small" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Initializing SMS Protection...
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
        <View style={[styles.shieldContainer, { backgroundColor: isMonitoring ? KAVACHColors.success + '15' : theme.backgroundSecondary }]}>
          <Animated.View style={isMonitoring ? pulseStyle : undefined}>
            <Feather
              name="shield"
              size={64}
              color={isMonitoring ? KAVACHColors.success : theme.textSecondary}
            />
          </Animated.View>
        </View>
        <ThemedText type="h3" style={styles.title}>
          SMS Fraud Protection
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
          {isMonitoring
            ? 'Actively monitoring incoming messages'
            : 'Enable real-time protection to scan messages'}
        </ThemedText>
        {isMockMode && (
          <View style={[styles.mockBadge, { backgroundColor: KAVACHColors.warning + '20' }]}>
            <Feather name="info" size={12} color={KAVACHColors.warning} />
            <ThemedText type="caption" style={{ color: KAVACHColors.warning, marginLeft: 4 }}>
              Demo Mode - Build for real SMS
            </ThemedText>
          </View>
        )}
      </Animated.View>

      {/* Toggle Switch */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(500)}
        style={[styles.toggleCard, { backgroundColor: theme.card }]}
      >
        <View style={styles.toggleRow}>
          <View>
            <ThemedText type="small" style={{ fontWeight: '600' }}>
              Real-Time Monitoring
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Scan incoming SMS automatically
            </ThemedText>
          </View>
          <Switch
            value={isMonitoring}
            onValueChange={handleToggleMonitoring}
            trackColor={{ false: theme.border, true: KAVACHColors.success + '50' }}
            thumbColor={isMonitoring ? KAVACHColors.success : theme.textSecondary}
          />
        </View>
      </Animated.View>

      {/* Statistics Grid */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(500)}
        style={styles.statsGrid}
      >
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <ThemedText type="h2" style={{ color: KAVACHColors.primary }}>
            {stats.totalScanned}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Total Scanned
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <ThemedText type="h2" style={{ color: KAVACHColors.success }}>
            {stats.safeCount}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Safe
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <ThemedText type="h2" style={{ color: KAVACHColors.warning }}>
            {stats.warningCount}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Warnings
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <ThemedText type="h2" style={{ color: KAVACHColors.sos }}>
            {stats.dangerCount}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Fraud
          </ThemedText>
        </View>
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(500)}
        style={styles.actionsRow}
      >
        <Button
          onPress={handleScanAll}
          disabled={isScanning}
          style={{ backgroundColor: KAVACHColors.primary, flex: 1 }}
        >
          <Animated.View style={isScanning ? scanStyle : undefined}>
            <Feather name="search" size={18} color="#FFFFFF" />
          </Animated.View>
          <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: 8 }}>
            {isScanning ? 'Scanning...' : 'Scan All SMS'}
          </ThemedText>
        </Button>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[
            styles.tab,
            selectedTab === 'alerts' && { borderBottomColor: KAVACHColors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setSelectedTab('alerts')}
        >
          <ThemedText type="small" style={{ color: selectedTab === 'alerts' ? KAVACHColors.primary : theme.textSecondary }}>
            Recent Alerts ({recentAlerts.length})
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            selectedTab === 'blocked' && { borderBottomColor: KAVACHColors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setSelectedTab('blocked')}
        >
          <ThemedText type="small" style={{ color: selectedTab === 'blocked' ? KAVACHColors.primary : theme.textSecondary }}>
            Blocked ({blockedSenders.length})
          </ThemedText>
        </Pressable>
      </View>

      {/* Alerts List */}
      {selectedTab === 'alerts' && (
        <View style={styles.alertsList}>
          {recentAlerts.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No alerts yet
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center' }}>
                Scan your SMS or enable monitoring to detect fraud
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={recentAlerts}
              renderItem={renderAlertItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            />
          )}
        </View>
      )}

      {/* Blocked Senders */}
      {selectedTab === 'blocked' && (
        <View style={styles.blockedList}>
          {blockedSenders.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="user-x" size={48} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No blocked senders
              </ThemedText>
            </View>
          ) : (
            blockedSenders.map((sender, index) => (
              <Animated.View
                key={sender}
                entering={SlideInRight.delay(index * 50)}
                style={[styles.blockedItem, { backgroundColor: theme.card }]}
              >
                <View style={styles.blockedItemContent}>
                  <Feather name="slash" size={16} color={KAVACHColors.sos} />
                  <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
                    {sender}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      'Unblock Sender?',
                      `Remove ${sender} from blocked list?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Unblock', onPress: () => {} }
                      ]
                    );
                  }}
                >
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>
      )}

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="info" size={16} color={KAVACHColors.primary} />
        <View style={{ marginLeft: Spacing.md, flex: 1 }}>
          <ThemedText type="small" style={{ fontWeight: '600', marginBottom: 4 }}>
            How it works
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            KAVACH analyzes incoming SMS in real-time using AI-powered fraud detection.
            Messages are scored from 0-100% risk and categorized as Safe, Warning, or Danger.
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl']
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl
  },
  shieldContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg
  },
  title: {
    marginBottom: Spacing.sm
  },
  mockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md
  },
  toggleCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center'
  },
  actionsRow: {
    marginBottom: Spacing.xl
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center'
  },
  alertsList: {},
  alertCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full
  },
  alertContent: {
    marginBottom: Spacing.sm
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm
  },
  reasonTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm
  },
  alertActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)'
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full
  },
  blockedList: {
    gap: Spacing.sm
  },
  blockedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md
  },
  blockedItemContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  emptyState: {
    padding: Spacing['2xl'],
    borderRadius: BorderRadius.md,
    alignItems: 'center'
  },
  infoCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl
  }
});
