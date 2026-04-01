/**
 * Behavior Analytics Dashboard
 * Showcases user behavior tracking, BAA, cursor analysis, and cognitive patterns
 * for hackathon demonstration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { cursorAnalysis, CursorMetrics, TouchPoint } from '../services/cursorAnalysis';
import { cognitiveAnalysis, CognitiveLoadIndicators, CognitiveAnalysisResult } from '../services/cognitivePatternAnalysis';
import { bbaService, BiometricProfile, BBAComparisonResult } from '../services/behavioralBiometricAnalysis';
import { behaviorAnalysis } from '../services/behaviorAnalysis';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LiveMetrics {
  touchPoints: TouchPoint[];
  velocity: number;
  smoothness: number;
  gestures: number;
  anomalies: number;
}

const BehaviorAnalyticsDashboard: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'bba' | 'cognitive' | 'history'>('live');

  // Live tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
    touchPoints: [],
    velocity: 0,
    smoothness: 100,
    gestures: 0,
    anomalies: 0,
  });
  const [touchTrail, setTouchTrail] = useState<{ x: number; y: number }[]>([]);

  // BBA state
  const [bbaProfile, setBbaProfile] = useState<BiometricProfile | null>(null);
  const [bbaResult, setBbaResult] = useState<BBAComparisonResult | null>(null);

  // Cognitive state
  const [cognitiveResult, setCognitiveResult] = useState<CognitiveAnalysisResult | null>(null);
  const [cognitiveLoad, setCognitiveLoad] = useState<CognitiveLoadIndicators | null>(null);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const trackingAreaRef = useRef<View>(null);

  // Pan responder for touch tracking demo
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTracking,
      onMoveShouldSetPanResponder: () => isTracking,
      onPanResponderGrant: (evt) => {
        if (!isTracking) return;
        const { locationX, locationY } = evt.nativeEvent;
        cursorAnalysis.recordTouchStart(locationX, locationY);
        updateTouchTrail(locationX, locationY);
      },
      onPanResponderMove: (evt) => {
        if (!isTracking) return;
        const { locationX, locationY } = evt.nativeEvent;
        cursorAnalysis.recordTouchMove(locationX, locationY);
        updateTouchTrail(locationX, locationY);
        updateLiveMetrics();
      },
      onPanResponderRelease: (evt) => {
        if (!isTracking) return;
        const { locationX, locationY } = evt.nativeEvent;
        cursorAnalysis.recordTouchEnd(locationX, locationY);
        updateLiveMetrics();
      },
    })
  ).current;

  useEffect(() => {
    loadData();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadData = async () => {
    try {
      // Load BBA profile
      const profile = bbaService.getProfile();
      setBbaProfile(profile);

      // Load cognitive profile
      const cogProfile = cognitiveAnalysis.getProfile();
      if (cogProfile) {
        setCognitiveLoad(cogProfile.cognitiveBaseline);
      }

      // Get cognitive analysis
      const cogResult = cognitiveAnalysis.performAnalysis();
      setCognitiveResult(cogResult);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, []);

  const updateTouchTrail = (x: number, y: number) => {
    setTouchTrail(prev => {
      const newTrail = [...prev, { x, y }];
      // Keep only last 50 points for performance
      return newTrail.slice(-50);
    });
  };

  const updateLiveMetrics = () => {
    const session = cursorAnalysis.getCurrentSession();
    if (!session) return;

    const touchHistory = cursorAnalysis.getTouchHistory();
    const gestureHistory = cursorAnalysis.getGestureHistory();
    const anomalies = cursorAnalysis.getAnomalies();

    // Calculate current velocity
    let velocity = 0;
    if (touchHistory.length >= 2) {
      const last = touchHistory[touchHistory.length - 1];
      const prev = touchHistory[touchHistory.length - 2];
      const distance = Math.sqrt(Math.pow(last.x - prev.x, 2) + Math.pow(last.y - prev.y, 2));
      const time = (last.timestamp - prev.timestamp) / 1000;
      velocity = time > 0 ? distance / time : 0;
    }

    setLiveMetrics({
      touchPoints: touchHistory,
      velocity: Math.round(velocity),
      smoothness: session.metrics?.smoothnessScore || 100,
      gestures: gestureHistory.length,
      anomalies: anomalies.length,
    });
  };

  const startTracking = () => {
    cursorAnalysis.startSession('AnalyticsDashboard');
    cognitiveAnalysis.startSession('demo_user');
    setIsTracking(true);
    setTouchTrail([]);
    setLiveMetrics({
      touchPoints: [],
      velocity: 0,
      smoothness: 100,
      gestures: 0,
      anomalies: 0,
    });
  };

  const stopTracking = () => {
    const session = cursorAnalysis.endSession();
    setIsTracking(false);

    if (session) {
      // Get BBA comparison
      const comparison = bbaService.compareWithProfile(session);
      setBbaResult(comparison);

      // Get cognitive analysis
      const cogResult = cognitiveAnalysis.performAnalysis();
      setCognitiveResult(cogResult);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return '#FF3B30';
    if (score >= 50) return '#FF9500';
    if (score >= 25) return '#FFCC00';
    return '#34C759';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#34C759';
    if (score >= 60) return '#FFCC00';
    if (score >= 40) return '#FF9500';
    return '#FF3B30';
  };

  const renderLiveTab = () => (
    <View style={styles.tabContent}>
      {/* Touch Tracking Area */}
      <View style={styles.trackingSection}>
        <Text style={styles.sectionTitle}>Live Touch Tracking</Text>
        <Text style={styles.sectionSubtitle}>
          {isTracking ? 'Draw patterns in the area below' : 'Tap Start to begin tracking'}
        </Text>

        <View
          style={[styles.trackingArea, isTracking && styles.trackingAreaActive]}
          {...panResponder.panHandlers}
        >
          {/* Touch trail visualization */}
          {touchTrail.map((point, index) => (
            <View
              key={index}
              style={[
                styles.touchPoint,
                {
                  left: point.x - 5,
                  top: point.y - 5,
                  opacity: (index / touchTrail.length) * 0.8 + 0.2,
                  backgroundColor: isTracking ? '#007AFF' : '#ccc',
                },
              ]}
            />
          ))}

          {!isTracking && touchTrail.length === 0 && (
            <View style={styles.trackingPlaceholder}>
              <Ionicons name="finger-print" size={48} color="#ccc" />
              <Text style={styles.placeholderText}>Touch tracking area</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.trackingButton, isTracking && styles.trackingButtonActive]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Ionicons
            name={isTracking ? 'stop-circle' : 'play-circle'}
            size={24}
            color="#fff"
          />
          <Text style={styles.trackingButtonText}>
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Live Metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Animated.View style={[styles.metricIcon, isTracking && { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="speedometer" size={24} color="#007AFF" />
          </Animated.View>
          <Text style={styles.metricValue}>{liveMetrics.velocity}</Text>
          <Text style={styles.metricLabel}>Velocity (px/s)</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricIcon}>
            <Ionicons name="water" size={24} color="#34C759" />
          </View>
          <Text style={styles.metricValue}>{Math.round(liveMetrics.smoothness)}%</Text>
          <Text style={styles.metricLabel}>Smoothness</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricIcon}>
            <Ionicons name="hand-left" size={24} color="#FF9500" />
          </View>
          <Text style={styles.metricValue}>{liveMetrics.gestures}</Text>
          <Text style={styles.metricLabel}>Gestures</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricIcon}>
            <Ionicons name="warning" size={24} color="#FF3B30" />
          </View>
          <Text style={styles.metricValue}>{liveMetrics.anomalies}</Text>
          <Text style={styles.metricLabel}>Anomalies</Text>
        </View>
      </View>

      {/* Touch Points Counter */}
      <View style={styles.touchCounterCard}>
        <View style={styles.touchCounterRow}>
          <Ionicons name="analytics" size={20} color="#666" />
          <Text style={styles.touchCounterLabel}>Total Touch Points Recorded</Text>
        </View>
        <Text style={styles.touchCounterValue}>{liveMetrics.touchPoints.length}</Text>
      </View>
    </View>
  );

  const renderBBATab = () => (
    <View style={styles.tabContent}>
      {/* BBA Score Card */}
      <View style={styles.bbaScoreCard}>
        <View style={styles.bbaHeader}>
          <Ionicons name="finger-print" size={28} color="#fff" />
          <Text style={styles.bbaTitle}>Behavioral Biometric Analysis</Text>
        </View>

        {bbaResult ? (
          <View style={styles.bbaScoreContainer}>
            <View style={[styles.bbaScoreCircle, { borderColor: getScoreColor(bbaResult.overallScore) }]}>
              <Text style={styles.bbaScoreValue}>{Math.round(bbaResult.overallScore)}</Text>
              <Text style={styles.bbaScoreLabel}>Match %</Text>
            </View>
            <View style={styles.bbaRiskBadge}>
              <Text style={[styles.bbaRiskText, { color: getRiskColor(100 - bbaResult.overallScore) }]}>
                {bbaResult.riskLevel.toUpperCase()} RISK
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.bbaNoData}>
            <Text style={styles.bbaNoDataText}>Start tracking to generate BBA analysis</Text>
          </View>
        )}
      </View>

      {/* BBA Breakdown */}
      {bbaResult && (
        <View style={styles.bbaBreakdown}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>

          <View style={styles.bbaBreakdownItem}>
            <View style={styles.bbaBreakdownHeader}>
              <Ionicons name="keypad" size={20} color="#007AFF" />
              <Text style={styles.bbaBreakdownLabel}>Keystroke Dynamics</Text>
              <Text style={[styles.bbaBreakdownScore, { color: getScoreColor(bbaResult.keystrokeScore) }]}>
                {Math.round(bbaResult.keystrokeScore)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${bbaResult.keystrokeScore}%`, backgroundColor: getScoreColor(bbaResult.keystrokeScore) }]} />
            </View>
          </View>

          <View style={styles.bbaBreakdownItem}>
            <View style={styles.bbaBreakdownHeader}>
              <Ionicons name="hand-right" size={20} color="#FF9500" />
              <Text style={styles.bbaBreakdownLabel}>Touch Behavior</Text>
              <Text style={[styles.bbaBreakdownScore, { color: getScoreColor(bbaResult.touchScore) }]}>
                {Math.round(bbaResult.touchScore)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${bbaResult.touchScore}%`, backgroundColor: getScoreColor(bbaResult.touchScore) }]} />
            </View>
          </View>

          <View style={styles.bbaBreakdownItem}>
            <View style={styles.bbaBreakdownHeader}>
              <Ionicons name="move" size={20} color="#34C759" />
              <Text style={styles.bbaBreakdownLabel}>Cursor Movement</Text>
              <Text style={[styles.bbaBreakdownScore, { color: getScoreColor(bbaResult.cursorScore) }]}>
                {Math.round(bbaResult.cursorScore)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${bbaResult.cursorScore}%`, backgroundColor: getScoreColor(bbaResult.cursorScore) }]} />
            </View>
          </View>
        </View>
      )}

      {/* BBA Anomalies */}
      {bbaResult && bbaResult.anomalies.length > 0 && (
        <View style={styles.anomaliesSection}>
          <Text style={styles.sectionTitle}>Detected Anomalies</Text>
          {bbaResult.anomalies.map((anomaly, index) => (
            <View key={index} style={styles.anomalyItem}>
              <Ionicons name="alert-circle" size={16} color="#FF9500" />
              <Text style={styles.anomalyText}>{anomaly}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Profile Info */}
      <View style={styles.profileInfoCard}>
        <Text style={styles.sectionTitle}>Profile Status</Text>
        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Confidence Score</Text>
          <Text style={styles.profileInfoValue}>{bbaProfile?.confidenceScore || 0}%</Text>
        </View>
        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Sample Count</Text>
          <Text style={styles.profileInfoValue}>{bbaProfile?.sampleCount || 0}</Text>
        </View>
        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Typing Speed</Text>
          <Text style={styles.profileInfoValue}>
            {Math.round(bbaProfile?.keystrokeDynamics?.typingSpeed || 0)} CPM
          </Text>
        </View>
        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Avg Pressure</Text>
          <Text style={styles.profileInfoValue}>
            {(bbaProfile?.touchBehavior?.averagePressure || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderCognitiveTab = () => (
    <View style={styles.tabContent}>
      {/* Cognitive Load Card */}
      <View style={styles.cognitiveCard}>
        <View style={styles.cognitiveHeader}>
          <Ionicons name="brain" size={28} color="#fff" />
          <Text style={styles.cognitiveTitle}>Cognitive Pattern Analysis</Text>
        </View>

        {cognitiveResult ? (
          <View style={styles.cognitiveScoreContainer}>
            <View style={[styles.cognitiveScoreCircle, { borderColor: getRiskColor(cognitiveResult.riskScore) }]}>
              <Text style={styles.cognitiveScoreValue}>{Math.round(cognitiveResult.riskScore)}</Text>
              <Text style={styles.cognitiveScoreLabel}>Risk Score</Text>
            </View>
            <Text style={styles.cognitiveRecommendation}>
              {cognitiveResult.recommendation}
            </Text>
          </View>
        ) : (
          <View style={styles.bbaNoData}>
            <Text style={styles.bbaNoDataText}>Perform actions to generate cognitive analysis</Text>
          </View>
        )}
      </View>

      {/* Cognitive Load Indicators */}
      {cognitiveResult && (
        <View style={styles.cognitiveIndicators}>
          <Text style={styles.sectionTitle}>Cognitive Load Indicators</Text>

          <View style={styles.indicatorItem}>
            <View style={styles.indicatorHeader}>
              <Ionicons name="pulse" size={18} color="#007AFF" />
              <Text style={styles.indicatorLabel}>Task Complexity</Text>
            </View>
            <View style={styles.indicatorBarContainer}>
              <View style={styles.indicatorBar}>
                <View style={[styles.indicatorFill, { width: `${cognitiveResult.cognitiveLoad.taskComplexity}%` }]} />
              </View>
              <Text style={styles.indicatorValue}>{Math.round(cognitiveResult.cognitiveLoad.taskComplexity)}%</Text>
            </View>
          </View>

          <View style={styles.indicatorItem}>
            <View style={styles.indicatorHeader}>
              <Ionicons name="battery-half" size={18} color="#FF9500" />
              <Text style={styles.indicatorLabel}>User Fatigue</Text>
            </View>
            <View style={styles.indicatorBarContainer}>
              <View style={styles.indicatorBar}>
                <View style={[styles.indicatorFill, { width: `${cognitiveResult.cognitiveLoad.userFatigue}%`, backgroundColor: '#FF9500' }]} />
              </View>
              <Text style={styles.indicatorValue}>{Math.round(cognitiveResult.cognitiveLoad.userFatigue)}%</Text>
            </View>
          </View>

          <View style={styles.indicatorItem}>
            <View style={styles.indicatorHeader}>
              <Ionicons name="eye" size={18} color="#34C759" />
              <Text style={styles.indicatorLabel}>Attention Level</Text>
            </View>
            <View style={styles.indicatorBarContainer}>
              <View style={styles.indicatorBar}>
                <View style={[styles.indicatorFill, { width: `${cognitiveResult.cognitiveLoad.attentionLevel}%`, backgroundColor: '#34C759' }]} />
              </View>
              <Text style={styles.indicatorValue}>{Math.round(cognitiveResult.cognitiveLoad.attentionLevel)}%</Text>
            </View>
          </View>

          <View style={styles.indicatorItem}>
            <View style={styles.indicatorHeader}>
              <Ionicons name="fitness" size={18} color="#FF3B30" />
              <Text style={styles.indicatorLabel}>Stress Indicator</Text>
            </View>
            <View style={styles.indicatorBarContainer}>
              <View style={styles.indicatorBar}>
                <View style={[styles.indicatorFill, { width: `${cognitiveResult.cognitiveLoad.stressIndicator}%`, backgroundColor: '#FF3B30' }]} />
              </View>
              <Text style={styles.indicatorValue}>{Math.round(cognitiveResult.cognitiveLoad.stressIndicator)}%</Text>
            </View>
          </View>
        </View>
      )}

      {/* Detected Anomalies */}
      {cognitiveResult && cognitiveResult.anomalies.length > 0 && (
        <View style={styles.cognitiveAnomalies}>
          <Text style={styles.sectionTitle}>Behavioral Anomalies</Text>
          {cognitiveResult.anomalies.map((anomaly, index) => (
            <View key={index} style={styles.cognitiveAnomalyCard}>
              <View style={styles.anomalyHeader}>
                <View style={[styles.severityBadge, { backgroundColor: anomaly.severity === 'high' ? '#FF3B30' : anomaly.severity === 'medium' ? '#FF9500' : '#FFCC00' }]}>
                  <Text style={styles.severityText}>{anomaly.severity.toUpperCase()}</Text>
                </View>
                <Text style={styles.anomalyType}>{anomaly.type}</Text>
              </View>
              <Text style={styles.anomalyDescription}>{anomaly.description}</Text>
              <Text style={styles.anomalyConfidence}>Confidence: {Math.round(anomaly.confidence * 100)}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Behavior Flags */}
      {cognitiveResult && cognitiveResult.behaviorFlags.length > 0 && (
        <View style={styles.behaviorFlags}>
          <Text style={styles.sectionTitle}>Behavior Flags</Text>
          {cognitiveResult.behaviorFlags.map((flag, index) => (
            <View key={index} style={styles.flagItem}>
              <Ionicons name="flag" size={16} color="#FF9500" />
              <View style={styles.flagContent}>
                <Text style={styles.flagName}>{flag.flag}</Text>
                <Text style={styles.flagDescription}>{flag.description}</Text>
              </View>
              <Text style={styles.flagImpact}>+{flag.riskImpact}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderHistoryTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.historyCard}>
        <Text style={styles.sectionTitle}>Session History</Text>

        <View style={styles.historyItem}>
          <View style={styles.historyIcon}>
            <Ionicons name="time" size={20} color="#007AFF" />
          </View>
          <View style={styles.historyContent}>
            <Text style={styles.historyTitle}>Last Session</Text>
            <Text style={styles.historySubtitle}>
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          <View style={styles.historyBadge}>
            <Text style={styles.historyBadgeText}>Normal</Text>
          </View>
        </View>

        <View style={styles.historyStats}>
          <View style={styles.historyStatItem}>
            <Text style={styles.historyStatValue}>{bbaProfile?.sampleCount || 0}</Text>
            <Text style={styles.historyStatLabel}>Sessions</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.historyStatItem}>
            <Text style={styles.historyStatValue}>{liveMetrics.touchPoints.length}</Text>
            <Text style={styles.historyStatLabel}>Data Points</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.historyStatItem}>
            <Text style={styles.historyStatValue}>{bbaProfile?.confidenceScore || 0}%</Text>
            <Text style={styles.historyStatLabel}>Profile Confidence</Text>
          </View>
        </View>
      </View>

      {/* Data Collection Info */}
      <View style={styles.dataInfoCard}>
        <View style={styles.dataInfoHeader}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <Text style={styles.dataInfoTitle}>What We Track</Text>
        </View>

        <View style={styles.dataInfoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.dataInfoText}>Touch coordinates & pressure</Text>
        </View>
        <View style={styles.dataInfoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.dataInfoText}>Gesture patterns & velocity</Text>
        </View>
        <View style={styles.dataInfoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.dataInfoText}>Keystroke dynamics & timing</Text>
        </View>
        <View style={styles.dataInfoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.dataInfoText}>Navigation patterns</Text>
        </View>
        <View style={styles.dataInfoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.dataInfoText}>Decision-making behavior</Text>
        </View>
        <View style={styles.dataInfoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.dataInfoText}>Cognitive load indicators</Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Behavior Analytics</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'live' && styles.activeTab]}
          onPress={() => setActiveTab('live')}
        >
          <Ionicons
            name="radio"
            size={18}
            color={activeTab === 'live' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'live' && styles.activeTabText]}>Live</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'bba' && styles.activeTab]}
          onPress={() => setActiveTab('bba')}
        >
          <Ionicons
            name="finger-print"
            size={18}
            color={activeTab === 'bba' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'bba' && styles.activeTabText]}>BBA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'cognitive' && styles.activeTab]}
          onPress={() => setActiveTab('cognitive')}
        >
          <Ionicons
            name="brain"
            size={18}
            color={activeTab === 'cognitive' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'cognitive' && styles.activeTabText]}>Cognitive</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons
            name="time"
            size={18}
            color={activeTab === 'history' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'live' && renderLiveTab()}
        {activeTab === 'bba' && renderBBATab()}
        {activeTab === 'cognitive' && renderCognitiveTab()}
        {activeTab === 'history' && renderHistoryTab()}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#007AFF15',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },

  // Live tracking styles
  trackingSection: {
    marginBottom: 20,
  },
  trackingArea: {
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
  },
  trackingAreaActive: {
    borderColor: '#007AFF',
    borderStyle: 'solid',
  },
  trackingPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    color: '#ccc',
    fontSize: 14,
  },
  touchPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  trackingButtonActive: {
    backgroundColor: '#FF3B30',
  },
  trackingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  touchCounterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  touchCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  touchCounterLabel: {
    fontSize: 14,
    color: '#666',
  },
  touchCounterValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 8,
  },

  // BBA styles
  bbaScoreCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  bbaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  bbaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bbaScoreContainer: {
    alignItems: 'center',
  },
  bbaScoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bbaScoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  bbaScoreLabel: {
    fontSize: 12,
    color: '#aaa',
  },
  bbaRiskBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  bbaRiskText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  bbaNoData: {
    alignItems: 'center',
    padding: 20,
  },
  bbaNoDataText: {
    color: '#aaa',
    fontSize: 14,
  },
  bbaBreakdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bbaBreakdownItem: {
    marginBottom: 16,
  },
  bbaBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bbaBreakdownLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  bbaBreakdownScore: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  anomaliesSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  anomalyText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  profileInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  profileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  profileInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  // Cognitive styles
  cognitiveCard: {
    backgroundColor: '#2d1b69',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cognitiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cognitiveTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  cognitiveScoreContainer: {
    alignItems: 'center',
  },
  cognitiveScoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cognitiveScoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  cognitiveScoreLabel: {
    fontSize: 12,
    color: '#aaa',
  },
  cognitiveRecommendation: {
    marginTop: 16,
    fontSize: 14,
    color: '#ddd',
    textAlign: 'center',
    lineHeight: 20,
  },
  cognitiveIndicators: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  indicatorItem: {
    marginBottom: 16,
  },
  indicatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  indicatorLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  indicatorBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  indicatorBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  indicatorFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  indicatorValue: {
    width: 40,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  cognitiveAnomalies: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cognitiveAnomalyCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  anomalyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  anomalyType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  anomalyDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  anomalyConfidence: {
    fontSize: 12,
    color: '#999',
  },
  behaviorFlags: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  flagItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 10,
  },
  flagContent: {
    flex: 1,
  },
  flagName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  flagDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  flagImpact: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9500',
  },

  // History styles
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyContent: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historySubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyBadge: {
    backgroundColor: '#34C75920',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyBadgeText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  historyStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  historyStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  historyStatDivider: {
    width: 1,
    backgroundColor: '#eee',
  },
  historyStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  historyStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  dataInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  dataInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dataInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dataInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  dataInfoText: {
    fontSize: 14,
    color: '#666',
  },

  bottomPadding: {
    height: 32,
  },
});

export default BehaviorAnalyticsDashboard;
