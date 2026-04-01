/**
 * Security Dashboard Screen
 * Displays behavior analysis, SMS protection, risk metrics, and security alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { behaviorAnalysis } from '../services/behaviorAnalysis';
import { smsMonitor, SMSFraudAlert } from '../services/smsMonitor';

const { width } = Dimensions.get('window');

interface Alert {
  alertId: string;
  alertType: string;
  severity: string;
  riskScore: number;
  status: string;
  reauthRequired: boolean;
  createdAt: string;
}

interface Statistics {
  period: string;
  transactions: {
    total: number;
    totalAmount: number;
    avgAmount: number;
  };
  alerts: {
    total: number;
    pending: number;
    resolved: number;
  };
}

interface Profile {
  userId: string;
  transactionPatterns: {
    avgTransactionAmount: number;
    totalTransactions: number;
  };
  timePatterns: {
    preferredHours: number[];
  };
  riskMetrics: {
    overallRiskScore: number;
  };
  lastActivity: string;
}

interface SmsStats {
  totalScanned: number;
  fraudDetected: number;
  lastScanTime: string | null;
}

const SecurityDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [smsAlerts, setSmsAlerts] = useState<SMSFraudAlert[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [smsStats, setSmsStats] = useState<SmsStats>({ totalScanned: 0, fraudDetected: 0, lastScanTime: null });
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);
  const [smsMonitoringEnabled, setSmsMonitoringEnabled] = useState(false);

  useEffect(() => {
    loadData();
    checkSmsPermission();
  }, []);

  const checkSmsPermission = async () => {
    if (Platform.OS === 'android') {
      const hasPermission = await smsMonitor.hasPermissions();
      setSmsPermissionGranted(hasPermission);
      setSmsMonitoringEnabled(hasPermission);
    }
  };

  const requestSmsPermission = async () => {
    const granted = await smsMonitor.requestPermissions();
    setSmsPermissionGranted(granted);
    setSmsMonitoringEnabled(granted);
  };

  const loadData = async () => {
    try {
      const [alertsData, statsData, profileData, smsAlertsData] = await Promise.all([
        behaviorAnalysis.getAlerts(10),
        behaviorAnalysis.getStatistics(30),
        behaviorAnalysis.getProfile(),
        smsMonitor.getAlerts(20)
      ]);

      setAlerts(alertsData || []);
      setStatistics(statsData);
      setProfile(profileData);

      if (smsAlertsData) {
        setSmsAlerts(smsAlertsData);
        setSmsStats({
          totalScanned: smsAlertsData.length,
          fraudDetected: smsAlertsData.filter(a => a.isFraud).length,
          lastScanTime: smsAlertsData[0]?.createdAt || null
        });
      }
    } catch (error) {
      console.error('Error loading security data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, []);

  const getRiskColor = (score: number) => {
    if (score >= 75) return '#FF3B30';
    if (score >= 50) return '#FF9500';
    if (score >= 25) return '#FFCC00';
    return '#34C759';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 75) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 25) return 'Medium';
    return 'Low';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'warning';
      case 'high':
        return 'alert-circle';
      case 'medium':
        return 'alert';
      default:
        return 'information-circle';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#FF3B30';
      case 'high':
        return '#FF9500';
      case 'medium':
        return '#FFCC00';
      default:
        return '#34C759';
    }
  };

  const formatAlertType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading security data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const riskScore = profile?.riskMetrics?.overallRiskScore || 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security Dashboard</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Risk Score Card */}
        <View style={styles.riskCard}>
          <View style={styles.riskHeader}>
            <Ionicons name="shield-checkmark" size={24} color="#fff" />
            <Text style={styles.riskTitle}>Security Score</Text>
          </View>

          <View style={styles.riskScoreContainer}>
            <View
              style={[
                styles.riskScoreCircle,
                { borderColor: getRiskColor(riskScore) }
              ]}
            >
              <Text style={styles.riskScoreValue}>{riskScore}</Text>
              <Text style={styles.riskScoreLabel}>/ 100</Text>
            </View>
            <View style={styles.riskInfo}>
              <Text style={[styles.riskLevel, { color: getRiskColor(riskScore) }]}>
                {getRiskLevel(riskScore)} Risk
              </Text>
              <Text style={styles.riskDescription}>
                {riskScore < 25
                  ? 'Your account is secure. Keep it up!'
                  : riskScore < 50
                  ? 'Some unusual activity detected. Stay vigilant.'
                  : riskScore < 75
                  ? 'Multiple risk factors detected. Review your activity.'
                  : 'Critical risk level. Immediate action recommended.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="swap-horizontal" size={24} color="#007AFF" />
            <Text style={styles.statValue}>
              {statistics?.transactions?.total || 0}
            </Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="alert-circle" size={24} color="#FF9500" />
            <Text style={styles.statValue}>
              {statistics?.alerts?.total || 0}
            </Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            <Text style={styles.statValue}>
              {statistics?.alerts?.resolved || 0}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* SMS Protection Section */}
        {Platform.OS === 'android' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SMS Protection</Text>

            <View style={styles.smsCard}>
              <View style={styles.smsHeader}>
                <View style={styles.smsIconContainer}>
                  <Ionicons name="chatbubble-ellipses" size={24} color="#007AFF" />
                </View>
                <View style={styles.smsInfo}>
                  <Text style={styles.smsTitle}>SMS Fraud Detection</Text>
                  <Text style={styles.smsSubtitle}>
                    {smsPermissionGranted
                      ? 'Monitoring incoming messages'
                      : 'Grant permission to enable'}
                  </Text>
                </View>
                {smsPermissionGranted ? (
                  <Switch
                    value={smsMonitoringEnabled}
                    onValueChange={setSmsMonitoringEnabled}
                    trackColor={{ false: '#ddd', true: '#007AFF50' }}
                    thumbColor={smsMonitoringEnabled ? '#007AFF' : '#f4f3f4'}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.enableButton}
                    onPress={requestSmsPermission}
                  >
                    <Text style={styles.enableButtonText}>Enable</Text>
                  </TouchableOpacity>
                )}
              </View>

              {smsPermissionGranted && (
                <>
                  <View style={styles.smsDivider} />
                  <View style={styles.smsStatsRow}>
                    <View style={styles.smsStatItem}>
                      <Ionicons name="scan-outline" size={20} color="#666" />
                      <Text style={styles.smsStatValue}>{smsStats.totalScanned}</Text>
                      <Text style={styles.smsStatLabel}>Scanned</Text>
                    </View>
                    <View style={styles.smsStatItem}>
                      <Ionicons name="warning-outline" size={20} color="#FF3B30" />
                      <Text style={[styles.smsStatValue, { color: '#FF3B30' }]}>
                        {smsStats.fraudDetected}
                      </Text>
                      <Text style={styles.smsStatLabel}>Fraud Detected</Text>
                    </View>
                    <View style={styles.smsStatItem}>
                      <Ionicons name="time-outline" size={20} color="#666" />
                      <Text style={styles.smsStatValue}>
                        {smsStats.lastScanTime
                          ? new Date(smsStats.lastScanTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : 'N/A'}
                      </Text>
                      <Text style={styles.smsStatLabel}>Last Scan</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Recent SMS Alerts */}
            {smsAlerts.length > 0 && (
              <View style={styles.smsAlertsContainer}>
                <Text style={styles.subsectionTitle}>Recent SMS Alerts</Text>
                {smsAlerts.slice(0, 3).map((alert) => (
                  <View key={alert.alertId} style={styles.smsAlertItem}>
                    <View
                      style={[
                        styles.smsAlertIcon,
                        { backgroundColor: alert.riskLevel === 'critical' || alert.riskLevel === 'high' ? '#FF3B3020' : '#FF950020' }
                      ]}
                    >
                      <Ionicons
                        name={alert.riskLevel === 'critical' ? 'skull-outline' : 'warning-outline'}
                        size={20}
                        color={alert.riskLevel === 'critical' || alert.riskLevel === 'high' ? '#FF3B30' : '#FF9500'}
                      />
                    </View>
                    <View style={styles.smsAlertContent}>
                      <Text style={styles.smsAlertSender}>{alert.sender}</Text>
                      <Text style={styles.smsAlertPreview} numberOfLines={1}>
                        {alert.preview}
                      </Text>
                    </View>
                    <View style={styles.smsAlertMeta}>
                      <Text style={[
                        styles.smsAlertScore,
                        { color: alert.fraudScore >= 70 ? '#FF3B30' : '#FF9500' }
                      ]}>
                        {alert.fraudScore}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Behavior Patterns */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Behavior Patterns</Text>

          <View style={styles.patternCard}>
            <View style={styles.patternRow}>
              <View style={styles.patternItem}>
                <Ionicons name="cash-outline" size={20} color="#666" />
                <Text style={styles.patternLabel}>Avg Transaction</Text>
                <Text style={styles.patternValue}>
                  ₹{Math.round(profile?.transactionPatterns?.avgTransactionAmount || 0).toLocaleString()}
                </Text>
              </View>

              <View style={styles.patternItem}>
                <Ionicons name="repeat-outline" size={20} color="#666" />
                <Text style={styles.patternLabel}>Total Transactions</Text>
                <Text style={styles.patternValue}>
                  {profile?.transactionPatterns?.totalTransactions || 0}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.patternRow}>
              <View style={styles.patternItem}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.patternLabel}>Active Hours</Text>
                <Text style={styles.patternValue}>
                  {profile?.timePatterns?.preferredHours?.length > 0
                    ? `${profile.timePatterns.preferredHours[0]}:00 - ${profile.timePatterns.preferredHours[profile.timePatterns.preferredHours.length - 1]}:00`
                    : 'Building profile...'}
                </Text>
              </View>

              <View style={styles.patternItem}>
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.patternLabel}>Last Activity</Text>
                <Text style={styles.patternValue}>
                  {profile?.lastActivity
                    ? formatDate(profile.lastActivity)
                    : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Alerts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            {alerts.length > 0 && (
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {alerts.length === 0 ? (
            <View style={styles.emptyAlerts}>
              <Ionicons name="shield-checkmark" size={48} color="#34C759" />
              <Text style={styles.emptyAlertsTitle}>All Clear!</Text>
              <Text style={styles.emptyAlertsText}>
                No security alerts in the last 30 days
              </Text>
            </View>
          ) : (
            alerts.map((alert) => (
              <TouchableOpacity key={alert.alertId} style={styles.alertCard}>
                <View
                  style={[
                    styles.alertIconContainer,
                    { backgroundColor: getSeverityColor(alert.severity) + '20' }
                  ]}
                >
                  <Ionicons
                    name={getSeverityIcon(alert.severity)}
                    size={24}
                    color={getSeverityColor(alert.severity)}
                  />
                </View>

                <View style={styles.alertContent}>
                  <Text style={styles.alertType}>
                    {formatAlertType(alert.alertType)}
                  </Text>
                  <Text style={styles.alertDate}>
                    {formatDate(alert.createdAt)}
                  </Text>
                  <View style={styles.alertMeta}>
                    <View
                      style={[
                        styles.alertBadge,
                        {
                          backgroundColor:
                            alert.status === 'pending' ? '#FF950020' : '#34C75920'
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.alertBadgeText,
                          {
                            color:
                              alert.status === 'pending' ? '#FF9500' : '#34C759'
                          }
                        ]}
                      >
                        {alert.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.alertScore}>
                      Risk: {alert.riskScore}%
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Security Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Tips</Text>

          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={24} color="#007AFF" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Keep Your App Updated</Text>
              <Text style={styles.tipText}>
                Regular updates include security patches to protect your account.
              </Text>
            </View>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="finger-print-outline" size={24} color="#007AFF" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Enable Biometric Lock</Text>
              <Text style={styles.tipText}>
                Use fingerprint or face recognition for faster, secure access.
              </Text>
            </View>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="eye-off-outline" size={24} color="#007AFF" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Never Share Your PIN</Text>
              <Text style={styles.tipText}>
                Bank employees will never ask for your PIN or OTP.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  content: {
    flex: 1
  },
  riskCard: {
    margin: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden'
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  riskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8
  },
  riskScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  riskScoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  riskScoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff'
  },
  riskScoreLabel: {
    fontSize: 14,
    color: '#aaa'
  },
  riskInfo: {
    flex: 1,
    marginLeft: 20
  },
  riskLevel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8
  },
  riskDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 14
  },
  patternCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16
  },
  patternRow: {
    flexDirection: 'row'
  },
  patternItem: {
    flex: 1,
    alignItems: 'center'
  },
  patternLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8
  },
  patternValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 4
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16
  },
  emptyAlerts: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center'
  },
  emptyAlertsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34C759',
    marginTop: 12
  },
  emptyAlertsText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  alertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  alertContent: {
    flex: 1,
    marginLeft: 12
  },
  alertType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  alertDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: 'bold'
  },
  alertScore: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8
  },
  tipCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  tipContent: {
    flex: 1,
    marginLeft: 12
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  tipText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 18
  },
  bottomPadding: {
    height: 32
  },
  // SMS Protection styles
  smsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16
  },
  smsHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  smsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center'
  },
  smsInfo: {
    flex: 1,
    marginLeft: 12
  },
  smsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  smsSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  enableButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  enableButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  smsDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16
  },
  smsStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  smsStatItem: {
    alignItems: 'center'
  },
  smsStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4
  },
  smsStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2
  },
  smsAlertsContainer: {
    marginTop: 16
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12
  },
  smsAlertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8
  },
  smsAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  smsAlertContent: {
    flex: 1,
    marginLeft: 10
  },
  smsAlertSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  smsAlertPreview: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  smsAlertMeta: {
    alignItems: 'flex-end'
  },
  smsAlertScore: {
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default SecurityDashboardScreen;
