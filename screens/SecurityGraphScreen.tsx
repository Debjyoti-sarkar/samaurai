import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, ScrollView, Alert } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";
import Svg, { Line, Circle, G, Text as SvgText, Defs, RadialGradient, Stop, Filter, FeDropShadow, Path } from "react-native-svg";
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, useAnimatedProps, withDecay, Easing } from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  risk: "SAFE" | "RISKY" | "CRITICAL";
  details: string;
}

interface GraphEdge {
  from: string;
  to: string;
  isRisky: boolean;
}

const NODES: GraphNode[] = [
  { id: "user", label: "Root Subject", type: "ENTITY", x: width / 2, y: 180, risk: "SAFE", details: "Verified device owner profile matching behavioral biometrics." },
  { id: "device", label: "Agent-0X1A", type: "HARDWARE", x: (width / 2) - 120, y: 80, risk: "SAFE", details: "Trusted iOS terminal active since 12:00:00 GMT." },
  { id: "txn", label: "Payload ₹25K", type: "TRANSFER", x: (width / 2) + 120, y: 80, risk: "CRITICAL", details: "High-value asset transfer requested to unverified dark-node." },
  { id: "ip", label: "45.22.x.x (VPN)", type: "NETWORK", x: (width / 2) + 140, y: 260, risk: "RISKY", details: "Encrypted proxy network tunnel detected overseas." },
  { id: "otp", label: "Intercept Array", type: "PACKET", x: (width / 2) - 100, y: 280, risk: "CRITICAL", details: "Authentication packet sniffing identified by background thread." },
];

const EDGES: GraphEdge[] = [
  { from: "device", to: "user", isRisky: false },
  { from: "user", to: "txn", isRisky: false },
  { from: "ip", to: "txn", isRisky: true },
  { from: "otp", to: "user", isRisky: true },
  { from: "otp", to: "txn", isRisky: true },
];

const TIMELINE_EVENTS = [
  { id: "ev-1", node: NODES.find(n => n.id === "device")!, time: "08:15:00 GMT" },
  { id: "ev-2", node: NODES.find(n => n.id === "user")!, time: "08:16:12 GMT" },
  { id: "ev-3", node: NODES.find(n => n.id === "ip")!, time: "08:17:40 GMT" },
  { id: "ev-4", node: NODES.find(n => n.id === "otp")!, time: "08:18:22 GMT" },
  { id: "ev-5", node: NODES.find(n => n.id === "txn")!, time: "08:18:45 GMT" },
];

export default function SecurityGraphScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const activeAlertId = route.params?.alertId;
  
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "timeline">("graph");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const graphSnapshotRef = React.useRef<View>(null);

  // Pan & Zoom state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pulsing animation for critical lines
  const pulseScale = useSharedValue(1);
  const dataFlow = useSharedValue(0);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.3, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
      true
    );
    dataFlow.value = withRepeat(withTiming(-30, { duration: 1500, easing: Easing.linear }), -1, false);
  }, []);

  const animatedPulseProps = useAnimatedProps(() => ({
    r: 40 * pulseScale.value
  }));

  const animatedFlowProps = useAnimatedProps(() => ({
    strokeDashoffset: dataFlow.value
  }));

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      let finalScale = scale.value;
      if (finalScale < 0.4) finalScale = 0.4;
      if (finalScale > 4) finalScale = 4;
      scale.value = withSpring(finalScale, { damping: 15 });
      savedScale.value = finalScale;
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Divide by savedScale to eliminate perceived drag resistance / over-sensitivity
      translateX.value = savedTranslateX.value + e.translationX / savedScale.value;
      translateY.value = savedTranslateY.value + e.translationY / savedScale.value;
    })
    .onEnd((e) => {
      translateX.value = withDecay({ velocity: e.velocityX / savedScale.value });
      translateY.value = withDecay({ velocity: e.velocityY / savedScale.value });
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      let finalScale = scale.value > 1.5 ? 1 : 2;
      scale.value = withSpring(finalScale, { damping: 14, stiffness: 90 });
      savedScale.value = finalScale;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture);

  const handleNodeTap = (node: GraphNode) => {
    setSelectedNode(node);
    translateX.value = withSpring(-node.x, { damping: 14, stiffness: 90 });
    translateY.value = withSpring(-node.y, { damping: 14, stiffness: 90 });
    scale.value = withSpring(1.5, { damping: 14, stiffness: 90 });
    savedScale.value = 1.5;
  };

  const handleResetView = () => {
    setSelectedNode(null);
    translateX.value = withSpring(0, { damping: 14, stiffness: 90 });
    translateY.value = withSpring(0, { damping: 14, stiffness: 90 });
    scale.value = withSpring(1, { damping: 14, stiffness: 90 });
    savedScale.value = 1;
  };

  const handleExportPNG = async () => {
    try {
      setShowExportMenu(false);
      const uri = await captureRef(graphSnapshotRef, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, { dialogTitle: "Export Intelligence Graph as PNG" });
    } catch (e) {
      Alert.alert("Export Failed", "Could not capture the graphics view.");
    }
  };

  const handleExportJSON = async () => {
    try {
      setShowExportMenu(false);
      const fs = FileSystem as any;
      const fileUri = (fs.documentDirectory || "file:///") + "kavach_topology.json";
      const payload = JSON.stringify({ nodes: NODES, edges: EDGES, timeline: TIMELINE_EVENTS }, null, 2);
      await fs.writeAsStringAsync(fileUri, payload);
      await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: "Export Intelligence Data JSON" });
    } catch (e) {
      Alert.alert("Export Failed", "Could not write JSON mapping.");
    }
  };

  const handleExportPDF = async () => {
    try {
      setShowExportMenu(false);
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #1e1e24; }
              h1 { color: #d32f2f; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
              p { font-size: 14px; color: #555; }
              .node-card { padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; background: #fafafa; }
              .critical { border-left: 6px solid #d32f2f; background-color: #ffeaea; }
              .warning { border-left: 6px solid #ffa000; }
              .safe { border-left: 6px solid #388e3c; }
              .badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #fff; }
              .badge-app { background: #3f51b5; }
              .badge-ip { background: #ff9800; }
              .badge-auth { background: #9c27b0; }
            </style>
          </head>
          <body>
            <h1>KAVACH Topology Diagnostic Report</h1>
            <p>Generated at: ${new Date().toLocaleString()}</p>
            <hr/>
            <h3>Entity Scan Results</h3>
            ${NODES.map(n => `
              <div class="node-card ${n.risk === 'CRITICAL' ? 'critical' : n.risk === 'RISKY' ? 'warning' : 'safe'}">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
                  ${n.label} <span class="badge badge-${n.type.toLowerCase()}">${n.type}</span>
                </div>
                <div style="font-size: 13px; margin-bottom: 5px;"><strong>Risk Level:</strong> ${n.risk}</div>
                <div style="font-size: 13px;"><strong>Details:</strong> ${n.details}</div>
              </div>
            `).join('')}
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { dialogTitle: "Export PDF Architecture Report" });
    } catch (e) {
      Alert.alert("Export Failed", "Could not compile PDF report.");
    }
  };

  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "SAFE": return KAVACHColors.success;
      case "RISKY": return KAVACHColors.warning;
      case "CRITICAL": return KAVACHColors.sos;
      default: return theme.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      
      {/* Background Radar Grid */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width="100%" height="100%">
          {[...Array(20)].map((_, i) => (
            <Line key={`v-${i}`} x1={i * 40} y1={0} x2={i * 40} y2={height} stroke="rgba(255,255,255,0.03)" />
          ))}
          {[...Array(30)].map((_, i) => (
            <Line key={`h-${i}`} x1={0} y1={i * 40} x2={width} y2={i * 40} stroke="rgba(255,255,255,0.03)" />
          ))}
        </Svg>
      </View>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText type="h2" style={styles.title}>{activeAlertId ? "Active Investigation" : "Topology Scan"}</ThemedText>
            <ThemedText type="caption" style={{ color: activeAlertId ? KAVACHColors.primary : theme.textSecondary, letterSpacing: 2 }}>
              {activeAlertId ? "DEEP DIVE: ALERT TRACE" : "INTERACTIVE THREAT VECTOR GRAPH"}
            </ThemedText>
          </View>
          <View style={styles.toggleRow}>
            <Pressable 
              onPress={() => setViewMode("graph")} 
              style={[styles.toggleBtn, viewMode === "graph" && { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Feather name="share-2" size={16} color={viewMode === "graph" ? KAVACHColors.primary : theme.textSecondary} />
            </Pressable>
            <Pressable 
              onPress={() => setViewMode("timeline")} 
              style={[styles.toggleBtn, viewMode === "timeline" && { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Feather name="list" size={16} color={viewMode === "timeline" ? KAVACHColors.primary : theme.textSecondary} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Floating Map Controls */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.floatingControls}>
        <View style={{ position: 'relative' }}>
          <Pressable onPress={() => setShowExportMenu(!showExportMenu)} style={[styles.fabBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="download" size={20} color={theme.text} />
          </Pressable>
          
          {showExportMenu && (
            <View style={[styles.exportMenu, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Pressable style={styles.exportItem} onPress={handleExportPNG}>
                <Feather name="image" size={14} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <ThemedText type="small" style={{ fontWeight: '600' }}>Save PNG</ThemedText>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              <Pressable style={styles.exportItem} onPress={handleExportPDF}>
                <Feather name="file-text" size={14} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <ThemedText type="small" style={{ fontWeight: '600' }}>Export PDF</ThemedText>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              <Pressable style={styles.exportItem} onPress={handleExportJSON}>
                <Feather name="code" size={14} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <ThemedText type="small" style={{ fontWeight: '600' }}>Raw JSON</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {viewMode === "graph" && (
          <Pressable onPress={handleResetView} style={[styles.fabBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Feather name="crosshair" size={20} color={theme.text} />
          </Pressable>
        )}
      </Animated.View>

      <View ref={graphSnapshotRef} style={{ flex: 1, backgroundColor: theme.backgroundRoot }} collapsable={false}>
      {viewMode === "graph" ? (
        <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.graphContainer, animatedCanvasStyle]}>
          <Svg width={width * 2} height={height * 1.5} style={{ left: -width/2, top: -height/4 }}>
            <Defs>
              <RadialGradient id="criticalGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={KAVACHColors.sos} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={KAVACHColors.sos} stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Edges */}
            {EDGES.map((edge, i) => {
              const fromNode = NODES.find(n => n.id === edge.from);
              const toNode = NODES.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              
              // Canvas shifted coordinates
              const x1 = fromNode.x + width/2;
              const y1 = fromNode.y + height/4;
              const x2 = toNode.x + width/2;
              const y2 = toNode.y + height/4;

              return (
                <React.Fragment key={`edge-${i}`}>
                   {/* Background solid link */}
                   <Line
                     x1={x1} y1={y1} x2={x2} y2={y2}
                     stroke={edge.isRisky ? KAVACHColors.sos : KAVACHColors.success}
                     strokeWidth={edge.isRisky ? 3 : 1.5}
                     opacity={0.3}
                   />
                   {/* Foreground structural data particle stream */}
                   <AnimatedLine
                     x1={x1} y1={y1} x2={x2} y2={y2}
                     stroke={edge.isRisky ? KAVACHColors.sos : KAVACHColors.success}
                     strokeWidth={edge.isRisky ? 3 : 1.5}
                     strokeDasharray={edge.isRisky ? "4 8" : "2 6"}
                     animatedProps={animatedFlowProps}
                   />
                </React.Fragment>
              );
            })}

            {/* Nodes */}
            {NODES.map((node, i) => {
              const isSelected = selectedNode?.id === node.id;
              const x = node.x + width/2;
              const y = node.y + height/4;
              
              return (
                <G key={`node-${i}`} onPress={() => handleNodeTap(node)}>
                  {/* Background Aura for Selected Node without killing processing power */}
                  {isSelected && (
                    <AnimatedCircle cx={x} cy={y} fill="rgba(255,255,255,0.08)" animatedProps={animatedPulseProps} />
                  )}
                  {/* Background Aura for Critical Nodes */}
                  {node.risk === 'CRITICAL' && (
                    <AnimatedCircle cx={x} cy={y} fill="url(#criticalGlow)" animatedProps={animatedPulseProps} />
                  )}

                  {/* Underlay glow circle to replace feDropShadow CPU-heavy processing */}
                  <Circle cx={x} cy={y} r={isSelected ? 34 : 30} fill={getRiskColor(node.risk) + '10'} />

                  {/* Core Node */}
                  <Circle
                    cx={x} cy={y}
                    r={isSelected ? 30 : 26}
                    fill={theme.card}
                    stroke={getRiskColor(node.risk)}
                    strokeWidth={isSelected ? 5 : 3}
                  />

                  {/* Node Label Text */}
                  <SvgText x={x} y={y + 50} fill={theme.text} fontSize="12" fontWeight="700" textAnchor="middle" letterSpacing={0.5}>
                    {node.label}
                  </SvgText>
                  
                  {/* Inner Node Icon Placeholder (Simulated by generic circle or initials) */}
                   <SvgText x={x} y={y + 5} fill={theme.text} fontSize="14" fontWeight="800" textAnchor="middle">
                     {node.type.charAt(0)}
                   </SvgText>
                </G>
              );
            })}
          </Svg>
        </Animated.View>
      </GestureDetector>
      ) : (
        <ScrollView contentContainerStyle={styles.timelineScroll} showsVerticalScrollIndicator={false}>
          {TIMELINE_EVENTS.map((ev, i) => {
            const isCritical = ev.node.risk === 'CRITICAL';
            const riskColor = getRiskColor(ev.node.risk);
            
            return (
              <Animated.View key={ev.id} entering={FadeInDown.delay(200 + i * 100)} style={styles.timelineItem}>
                <View style={styles.timelineGraphic}>
                  <View style={[styles.timelineNode, { borderColor: riskColor, backgroundColor: isCritical ? riskColor + '20' : theme.card }]}>
                    <ThemedText type="small" style={{ fontWeight: '800', color: riskColor }}>{ev.node.type.charAt(0)}</ThemedText>
                  </View>
                  {i !== TIMELINE_EVENTS.length - 1 && (
                     <View style={[styles.timelineLine, { backgroundColor: theme.border }]}>
                        <Feather name="arrow-down" size={12} color={theme.textSecondary} style={{ position: 'absolute', bottom: -10, left: -4 }} />
                     </View>
                  )}
                </View>

                <LinearGradient 
                  colors={[theme.card, isCritical ? KAVACHColors.sos + '20' : 'rgba(25,30,40,0.4)']} 
                  style={[styles.timelineCard, { borderColor: isCritical ? KAVACHColors.sos : theme.border }]}
                >
                  <View style={styles.timelineCardHeader}>
                    <ThemedText type="h4" style={{ color: riskColor }}>{ev.node.label}</ThemedText>
                    <ThemedText type="caption" style={{ color: '#888' }}>{ev.time}</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                    {ev.node.details}
                  </ThemedText>
                  <View style={[styles.badge, { alignSelf: 'flex-start', backgroundColor: riskColor + '20' }]}>
                     <ThemedText type="caption" style={{ color: riskColor, fontWeight: '700' }}>{ev.node.risk} VECTOR</ThemedText>
                  </View>
                </LinearGradient>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
      </View>

      {/* Details Card HUD */}
      {viewMode === "graph" && selectedNode ? (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.hudCardWrapper, { bottom: Spacing.xl }]}>
          <LinearGradient
            colors={['rgba(20,25,35,0.95)', 'rgba(10,15,25,0.95)']}
            style={[styles.detailsCard, { borderColor: getRiskColor(selectedNode.risk) }]}
          >
            <View style={styles.detailsHeader}>
              <View style={[styles.badge, { backgroundColor: getRiskColor(selectedNode.risk) + '20' }]}>
                 <ThemedText type="small" style={{ color: getRiskColor(selectedNode.risk), fontWeight: '700', letterSpacing: 1 }}>{selectedNode.type}</ThemedText>
              </View>
              <Pressable onPress={() => setSelectedNode(null)} style={{ padding: 4 }}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText type="h3" style={{ marginBottom: Spacing.xs, textTransform: 'uppercase' }}>{selectedNode.label}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22 }}>
              {selectedNode.details}
            </ThemedText>

            {selectedNode.risk !== 'SAFE' && (
               <Pressable style={[styles.actionBtn, { borderColor: KAVACHColors.sos, backgroundColor: KAVACHColors.sos + '10' }]}>
                 <Feather name="shield-off" size={16} color={KAVACHColors.sos} />
                 <ThemedText style={{ color: KAVACHColors.sos, marginLeft: 8, fontWeight: '700' }}>INITIALIZE OVERRIDE</ThemedText>
               </Pressable>
            )}
          </LinearGradient>
        </Animated.View>
      ) : (
        <View style={[styles.hudCardWrapper, { bottom: Spacing.xl }]} pointerEvents="none">
          <View style={[styles.hudCardEmpty, { borderColor: theme.border, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <Feather name="maximize-2" size={16} color={theme.textSecondary} style={{ marginBottom: 4 }} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center', letterSpacing: 1 }}>
              PINCH TO ZOOM • PAN CANVAS • TAP NODES
            </ThemedText>
          </View>
        </View>
      )}
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  header: { padding: Spacing.xl, paddingTop: Spacing.xl * 2, zIndex: 10, position: 'absolute', top: 0, left: 0, width: '100%' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  toggleBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'transparent' },
  floatingControls: { position: 'absolute', top: 130, right: Spacing.lg, zIndex: 100, gap: Spacing.md },
  fabBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10 },
  title: { fontWeight: "800", textTransform: 'uppercase', marginBottom: 2 },
  graphContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  hudCardWrapper: { position: 'absolute', width: '90%', alignSelf: 'center', zIndex: 50 },
  hudCardEmpty: { justifyContent: 'center', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.full, borderWidth: 1, alignSelf: 'center' },
  detailsCard: { padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.lg },
  exportMenu: { position: 'absolute', top: 0, right: 55, width: 150, borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.xs, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  exportItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, paddingVertical: Spacing.md },
  menuDivider: { height: 1, width: '100%' },
  
  // Timeline Styles
  timelineScroll: { paddingTop: 140, paddingBottom: 100, paddingHorizontal: Spacing.xl },
  timelineItem: { flexDirection: 'row', marginBottom: Spacing.xl },
  timelineGraphic: { width: 40, alignItems: 'center', marginRight: Spacing.md },
  timelineNode: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
  timelineLine: { width: 2, flex: 1, marginTop: -5, marginBottom: -15, zIndex: 1 },
  timelineCard: { flex: 1, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm }
});
