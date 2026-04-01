import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Dimensions, FlatList, InteractionManager } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Svg, { Path, Rect, Circle as SvgCircle, Defs, RadialGradient, Stop, Filter, FeDropShadow, Text as SvgText, G } from "react-native-svg";
import Animated, { FadeInDown, useAnimatedProps, useSharedValue, withTiming, Easing, withRepeat, withSequence, useAnimatedStyle, Layout } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { useSecurityIntelligence } from "@/contexts/SecurityIntelligenceContext";

const { width } = Dimensions.get("window");
// Ensure charts fit nicely in the horizontal scroll or vertical stack
const CHART_WIDTH = 260; 
const CHART_HEIGHT = 140;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

const getRiskColor = (scoreOrSeverity: number | string) => {
  if (typeof scoreOrSeverity === "string") {
    if (scoreOrSeverity === "HIGH" || scoreOrSeverity === "CRITICAL") return KAVACHColors.sos;
    if (scoreOrSeverity === "MEDIUM" || scoreOrSeverity === "ELEVATED") return KAVACHColors.warning;
    return KAVACHColors.success;
  }
  if (scoreOrSeverity < 40) return KAVACHColors.success;
  if (scoreOrSeverity < 75) return KAVACHColors.warning;
  return KAVACHColors.sos;
};

// --- Custom Subcomponents for Clean Layout ---

const AnimatedCounter = ({ value, style }: { value: number, style: any }) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const fps = 60;
    const steps = duration / (1000 / fps);
    const stepValue = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setV(value);
        clearInterval(timer);
      } else {
        setV(Math.round(current));
      }
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [value]);
  return <ThemedText type="h2" style={style}>{v}</ThemedText>;
};

const MetricCard = ({ title, value, unit, icon, delay, theme, highlight }: any) => (
  <Animated.View entering={FadeInDown.delay(delay)} style={[styles.metricCard, { backgroundColor: theme.card, borderColor: highlight || theme.border }]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
      <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '600' }}>{title}</ThemedText>
      <Feather name={icon} color={highlight || theme.textSecondary} size={14} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <AnimatedCounter value={value} style={{ color: theme.text, textShadowColor: highlight || 'transparent', textShadowRadius: highlight ? 6 : 0 }} />
      {unit && <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>{unit}</ThemedText>}
    </View>
  </Animated.View>
);

const RiskPieChart = ({ alerts, theme }: any) => {
  const total = alerts.length || 1;
  const high = alerts.filter((a: any) => a.severity === 'HIGH').length;
  const med = alerts.filter((a: any) => a.severity === 'MEDIUM').length;
  const low = alerts.filter((a: any) => a.severity === 'LOW').length;

  const radius = 45;
  const circ = 2 * Math.PI * radius;
  
  const hCirc = (high / total) * circ;
  const mCirc = (med / total) * circ;
  const lCirc = (low / total) * circ;

  return (
    <LinearGradient colors={['rgba(25, 30, 45, 0.6)', theme.card]} style={[styles.chartBox, { borderColor: theme.border }]}>
      <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.md }}>Risk Distribution</ThemedText>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <SvgCircle cx="60" cy="60" r={radius} fill="none" stroke={theme.card} strokeWidth="18" />
          <SvgCircle cx="60" cy="60" r={radius} fill="none" stroke={KAVACHColors.sos} strokeWidth="12" strokeDasharray={`${hCirc}, ${circ}`} strokeDashoffset={0} strokeLinecap="round" />
          <SvgCircle cx="60" cy="60" r={radius} fill="none" stroke={KAVACHColors.warning} strokeWidth="12" strokeDasharray={`${mCirc}, ${circ}`} strokeDashoffset={-hCirc} strokeLinecap="round" />
          <SvgCircle cx="60" cy="60" r={radius} fill="none" stroke={KAVACHColors.success} strokeWidth="12" strokeDasharray={`${lCirc}, ${circ}`} strokeDashoffset={-(hCirc + mCirc)} strokeLinecap="round" />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <ThemedText type="h3">{total}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 10 }}>TOTAL</ThemedText>
        </View>
      </View>
    </LinearGradient>
  );
};

export default function SecurityInsightsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { targetRisk, fraudAttempts, otpUsage, alerts, threatsDetected, devicesMonitored, triggerAction, systemState } = useSecurityIntelligence();

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showExplain, setShowExplain] = React.useState<boolean>(false);
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => setIsReady(true));
  }, []);

  // SVG Line Animations
  const pathProgress = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.3);
  const dataFlowOffset = useSharedValue(0);
  const bgOffset = useSharedValue(0);

  useEffect(() => {
    pathProgress.value = withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) });
    bgOffset.value = withRepeat(withTiming(40, { duration: 5000, easing: Easing.linear }), -1, false);

    if (systemState !== "SECURE") {
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.8, { duration: 1000 }), withTiming(0.1, { duration: 1000 })),
        -1,
        true
      );
      dataFlowOffset.value = withRepeat(withTiming(-15, { duration: 800, easing: Easing.linear }), -1, false);
    } else {
      pulseOpacity.value = 0.3;
      dataFlowOffset.value = 0;
    }
  }, [systemState]);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: 1000 - (pathProgress.value * 1000),
  }));

  const animatedFlowProps = useAnimatedProps(() => ({
    strokeDashoffset: dataFlowOffset.value,
  }));

  const animatedPulseProps = useAnimatedProps(() => ({
    opacity: pulseOpacity.value,
  }));

  const maxBarValue = Math.max(...fraudAttempts, 6);
  const barWidth = (CHART_WIDTH - Spacing.lg * 2) / fraudAttempts.length - 8;
  const maxLineValue = Math.max(...otpUsage, 25);
  const xStep = (CHART_WIDTH - Spacing.lg * 2) / (otpUsage.length - 1);
  const linePath = otpUsage.map((val, i) => {
    const x = i * xStep;
    const y = CHART_HEIGHT - (val / maxLineValue) * CHART_HEIGHT;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  const bgStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bgOffset.value }] }));
  const screenPulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value * 0.15 }));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>

      {/* Subtle Background Motion */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
         <Animated.View style={[StyleSheet.absoluteFill, bgStyle, { top: -40 }]}>
           <Svg width="100%" height="150%">
             {[...Array(40)].map((_, i) => (
               <Path key={`grid-${i}`} d={`M 0 ${i * 40} L ${width} ${i * 40}`} stroke={theme.border} strokeWidth="0.5" opacity={0.3} />
             ))}
           </Svg>
         </Animated.View>
      </View>

      {/* Critical System Overdrive Alert */}
      {targetRisk >= 75 && (
         <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: KAVACHColors.sos }, screenPulseStyle]} />
      )}

      <FlatList
        data={alerts}
        keyExtractor={item => item.id}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={11}
        removeClippedSubviews={true}
        decelerationRate="normal"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* HEADER */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
              <View>
                <ThemedText type="h2" style={styles.title}>Command Center</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, letterSpacing: 1, textTransform: 'uppercase' }}>Real-time Intelligence Feed</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Pressable onPress={() => navigation.navigate("SecurityGraph" as never)} style={[styles.hudBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
                   <Feather name="share-2" size={16} color={KAVACHColors.primary} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate("SecurityAlerts" as never)} style={[styles.hudBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
                   <Feather name="bell" size={16} color={KAVACHColors.warning} />
                </Pressable>
              </View>
            </Animated.View>

            {/* SYSTEM STATUS BAR */}
            <Animated.View entering={FadeInDown.delay(120)} layout={Layout.springify()}>
              <Pressable onPress={() => setShowExplain(!showExplain)}>
                <Animated.View style={[styles.statusBar, { backgroundColor: systemState === "RECOVERING" ? KAVACHColors.primary + '15' : getRiskColor(targetRisk) + '15', borderColor: systemState === "RECOVERING" ? KAVACHColors.primary + '50' : getRiskColor(targetRisk) + '50', marginBottom: showExplain ? 0 : Spacing.xl }]}>
                  <Animated.View style={[styles.statusPulse, { backgroundColor: systemState === "RECOVERING" ? KAVACHColors.primary : getRiskColor(targetRisk), opacity: pulseOpacity }]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ color: systemState === "RECOVERING" ? KAVACHColors.primary : getRiskColor(targetRisk), fontWeight: '800', letterSpacing: 1 }}>
                       SYSTEM {systemState}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>{alerts.length} Tracking Actions Engaged</ThemedText>
                  </View>
                  <Feather name={showExplain ? "chevron-up" : "chevron-down"} size={16} color={systemState === "RECOVERING" ? KAVACHColors.primary : getRiskColor(targetRisk)} />
                </Animated.View>
              </Pressable>

              {/* Explainable AI Status Breakdown */}
              {showExplain && (
                <Animated.View entering={FadeInDown} style={{ padding: Spacing.lg, backgroundColor: 'rgba(20,25,35,0.6)', borderBottomLeftRadius: BorderRadius.md, borderBottomRightRadius: BorderRadius.md, borderWidth: 1, borderTopWidth: 0, borderColor: theme.border, marginBottom: Spacing.xl }}>
                   <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                      System risk score is calibrated at <ThemedText type="caption" style={{ color: getRiskColor(targetRisk), fontWeight: '700' }}>{targetRisk}/100</ThemedText> due to {alerts.length} contributing anomalous factors.
                   </ThemedText>
                   <View style={{ marginTop: Spacing.sm }}>
                      {alerts.slice(0, 3).map((a, i) => (
                        <View key={`ex-${i}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                           <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: getRiskColor(a.severity), marginRight: 6 }} />
                           <ThemedText type="caption" style={{ color: theme.text, flex: 1 }} numberOfLines={1}>{a.title}</ThemedText>
                           <ThemedText type="caption" style={{ color: getRiskColor(a.severity), fontSize: 10 }}>{a.severity}</ThemedText>
                        </View>
                      ))}
                      {alerts.length > 3 && (
                         <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: 'italic' }}>+ {alerts.length - 3} additional latent events.</ThemedText>
                      )}
                      {alerts.length === 0 && (
                         <ThemedText type="caption" style={{ color: KAVACHColors.success, marginTop: 4 }}>No active threats detected. Diagnostic loops operational.</ThemedText>
                      )}
                   </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* SECTION 1: METRICS GRID */}
            <View style={styles.metricsGrid}>
              <MetricCard title="System Risk" value={targetRisk} unit="/ 100" icon="activity" delay={150} theme={theme} highlight={getRiskColor(targetRisk)} />
              <MetricCard title="Active Alerts" value={alerts.length} icon="radio" delay={200} theme={theme} />
              <MetricCard title="Threats Blocked" value={threatsDetected} icon="shield" delay={250} theme={theme} />
              <MetricCard title="Endpoints" value={devicesMonitored} icon="smartphone" delay={300} theme={theme} />
            </View>

            {/* SECTION 2: ANALYTICS SUITE */}
            {isReady ? (
            <Animated.View entering={FadeInDown}>
              <ThemedText type="h4" style={styles.sectionTitle}>Global Analytics</ThemedText>
              <ScrollView horizontal nestedScrollEnabled={true} directionalLockEnabled={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.md, gap: Spacing.md }}>
            
            {/* Pie Chart */}
            <RiskPieChart alerts={alerts} theme={theme} />

            {/* Line Chart */}
            <LinearGradient colors={['rgba(20, 25, 35, 0.6)', theme.card]} style={[styles.chartBox, { borderColor: theme.border }]}>
              <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.md }}>Authentication Volume</ThemedText>
              <Svg width={CHART_WIDTH - Spacing.lg * 2} height={CHART_HEIGHT}>
                <AnimatedPath d={linePath} stroke={KAVACHColors.info} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1000} animatedProps={animatedPathProps} />
              </Svg>
            </LinearGradient>

            {/* Bar Chart */}
            <LinearGradient colors={['rgba(20, 25, 35, 0.6)', theme.card]} style={[styles.chartBox, { borderColor: theme.border }]}>
              <ThemedText type="body" style={{ fontWeight: '600', marginBottom: Spacing.md }}>Fraud Anomalies</ThemedText>
              <Svg width={CHART_WIDTH - Spacing.lg * 2} height={CHART_HEIGHT}>
                {fraudAttempts.map((val, i) => {
                  const rectHeight = (val / maxBarValue) * CHART_HEIGHT;
                  const xPos = i * (barWidth + 8);
                  const yPos = CHART_HEIGHT - rectHeight;
                  const barColor = val > 3 ? KAVACHColors.sos : KAVACHColors.warning;
                  return <Rect key={`bar-${i}`} x={xPos} y={yPos} width={barWidth} height={rectHeight} fill={barColor} rx={3} opacity={0.85} />;
                })}
              </Svg>
            </LinearGradient>

              </ScrollView>
            </Animated.View>
            ) : <View style={{ height: CHART_HEIGHT + 60 }} />}

            {/* SECTION 3: TACTICAL WORLD MAP */}
            {isReady ? (
            <Animated.View entering={FadeInDown}>
              <ThemedText type="h4" style={styles.sectionTitle}>Threat Topography</ThemedText>
              <View style={[styles.mapContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <Defs>
                    <Filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                      <FeDropShadow dx="0" dy="0" stdDeviation="2" floodColor={KAVACHColors.sos} floodOpacity="0.8" />
                    </Filter>
                  </Defs>

                  {/* Abstract Continents representation */}
                  <Path d="M 8 15 Q 30 10 32 30 Q 18 45 12 30 Z" fill={theme.border} opacity={0.30} /> 
                  <Path d="M 28 45 Q 38 40 40 65 Q 26 85 22 70 Z" fill={theme.border} opacity={0.30} /> 
                  <Path d="M 45 10 Q 80 0 95 20 Q 98 45 70 40 Q 55 30 45 15 Z" fill={theme.border} opacity={0.30} /> 
                  <Path d="M 43 45 Q 65 38 68 65 Q 52 80 43 65 Z" fill={theme.border} opacity={0.30} /> 
                  <Path d="M 75 60 Q 95 55 90 80 Q 75 75 75 60 Z" fill={theme.border} opacity={0.30} /> 

                  {/* Geo-Grid Radar Rings (Home Base) */}
                  <SvgCircle cx="25" cy="45" r="40" stroke={theme.border} strokeWidth={0.5} fill="none" opacity={0.5} />
                  <SvgCircle cx="25" cy="45" r="20" stroke={theme.border} strokeWidth={0.5} fill="none" opacity={0.6} />

                  {/* Active Connections and Threat Nodes */}
                  {alerts.map(alert => {
                    if (!alert.geoPoint) return null;
                    const color = getRiskColor(alert.severity);
                    const isCritical = alert.severity === "HIGH";
                    const isSelected = expandedId === alert.id;
                    const hasFocus = expandedId ? isSelected : true;
                    
                    return (
                      <React.Fragment key={`conn-${alert.id}`}>
                        {/* Animated Data Particle Flow from Threat to Base */}
                        {alert.type !== "IDLE" && alert.type !== "NORMAL_OTP" && (
                          <AnimatedPath
                            d={`M ${alert.geoPoint.x} ${alert.geoPoint.y} L 25 45`}
                            stroke={color}
                            strokeWidth={isSelected ? "1.5" : "1"}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={isSelected ? "1.5, 4" : "1, 5"}
                            opacity={hasFocus ? (isCritical ? 0.9 : 0.6) : 0.15}
                            animatedProps={animatedFlowProps}
                          />
                        )}

                        {/* Threat Node Background Pulse */}
                        {isCritical && hasFocus && (
                          <AnimatedCircle
                            cx={alert.geoPoint.x}
                            cy={alert.geoPoint.y}
                            r={isSelected ? "6" : "4"}
                            fill={color}
                            animatedProps={animatedPulseProps}
                          />
                        )}

                        {/* Core Threat Node */}
                        <SvgCircle
                          cx={alert.geoPoint.x}
                          cy={alert.geoPoint.y}
                          r={isSelected ? "2.5" : (isCritical ? "1.5" : "1")}
                          fill={color}
                          opacity={hasFocus ? 1 : 0.3}
                          filter={(isCritical && hasFocus) ? "url(#glow)" : undefined}
                        />

                        {/* HUD Tactical Label */}
                        {isSelected && (
                          <G>
                             <Rect x={alert.geoPoint.x + 3} y={alert.geoPoint.y - 7} width="22" height="12" fill="rgba(10,15,25,0.7)" rx="2" stroke={color} strokeWidth="0.2" />
                             <SvgText
                               x={alert.geoPoint.x + 14}
                               y={alert.geoPoint.y - 3}
                               fill={color}
                               fontSize="2.5"
                               fontWeight="800"
                               textAnchor="middle"
                               letterSpacing="0.5"
                             >
                               {alert.type}
                             </SvgText>
                             <SvgText
                               x={alert.geoPoint.x + 14}
                               y={alert.geoPoint.y + 1}
                               fill={theme.textSecondary}
                               fontSize="2"
                               textAnchor="middle"
                             >
                               192.168.x.x • {alert.severity}
                             </SvgText>
                          </G>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Home Base Hub Node */}
                  <SvgCircle cx="25" cy="45" r="1.5" fill={theme.text} />
                  <SvgCircle cx="25" cy="45" r="3" stroke={theme.text} strokeWidth="0.5" fill="none" />
                </Svg>
              </View>
            </Animated.View>
            ) : <View style={{ height: 160 + Spacing.xl }} />}

            {/* SECTION 4: LIVE FEED TIMELINE */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
              <ThemedText type="h4" style={styles.sectionTitle}>Live Event Feed</ThemedText>
              <Pressable onPress={() => navigation.navigate("SecurityAlerts" as never)}>
                <ThemedText type="caption" style={{ color: KAVACHColors.primary, fontWeight: '700' }}>VIEW ALL ({alerts.length})</ThemedText>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: 'center', padding: Spacing.xl }}>System idle. No threats detected.</ThemedText>
        }
        renderItem={({ item: alert, index }) => {
              const color = getRiskColor(alert.severity);
              const isExpanded = expandedId === alert.id;
              return (
                <Animated.View key={alert.id} entering={FadeInDown.delay(100 * index)} layout={Layout.springify()} style={styles.feedRow}>
                  <View style={styles.feedGraphic}>
                    <View style={[styles.feedIcon, { borderColor: color, backgroundColor: color + '15' }]}>
                      <Feather name={alert.icon as any} size={12} color={color} />
                    </View>
                    {index !== Math.min(alerts.length, 4) - 1 && <View style={[styles.feedLine, { backgroundColor: alert.severity === "HIGH" ? color + '80' : theme.border }]} />}
                  </View>
                  <Pressable style={{ flex: 1 }} onPress={() => setExpandedId(prev => prev === alert.id ? null : alert.id)}>
                    <View style={[styles.feedCard, { backgroundColor: theme.card, borderColor: alert.severity === "HIGH" ? color + '50' : theme.border }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                         <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>{alert.title}</ThemedText>
                         <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 10 }}>{alert.timestamp}</ThemedText>
                      </View>
                      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }} numberOfLines={isExpanded ? undefined : 2}>{alert.description}</ThemedText>
                      
                      <View style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: color + '20' }}>
                        <ThemedText type="caption" style={{ color: color, fontSize: 9, fontWeight: '800' }}>{alert.severity} RISK</ThemedText>
                      </View>

                      {isExpanded && (
                        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.border, marginTop: Spacing.md, paddingTop: Spacing.md }}>
                          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={() => { setExpandedId(null); navigation.navigate('SecurityGraph' as any, { alertId: alert.id } as any); }}>
                            <Feather name="shield" size={14} color={KAVACHColors.primary} />
                            <ThemedText type="caption" style={{ color: KAVACHColors.primary, marginLeft: 4, fontWeight: '700' }}>Deep Dive</ThemedText>
                          </Pressable>
                          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onPress={() => { setExpandedId(null); triggerAction('ignore', alert.id); }}>
                            <Feather name="x" size={14} color={theme.textSecondary} />
                            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>Ignore</ThemedText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </Pressable>
                </Animated.View>
           );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.xl, paddingTop: Spacing.xl * 2, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
  title: { fontWeight: "800", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  hudBtn: { padding: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  
  statusBar: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xl },
  statusPulse: { width: 12, height: 12, borderRadius: 6, marginRight: Spacing.md },
  
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.xl },
  metricCard: { width: '47%', padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  
  sectionTitle: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, marginTop: Spacing.md },
  chartBox: { width: CHART_WIDTH, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1 },
  
  mapContainer: { width: '100%', height: 160, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing.xl },
  mapDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, transform: [{ translateX: -3 }, { translateY: -3 }] },
  mapPulse: { position: 'absolute', width: 20, height: 20, borderRadius: 10, left: -7, top: -7 },
  
  feedContainer: { marginTop: Spacing.sm },
  feedRow: { flexDirection: 'row', marginBottom: Spacing.md },
  feedGraphic: { width: 30, alignItems: 'center', marginRight: Spacing.md },
  feedIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  feedLine: { width: 1, flex: 1, marginTop: -4, marginBottom: -16, zIndex: 1 },
  feedCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 }
});
