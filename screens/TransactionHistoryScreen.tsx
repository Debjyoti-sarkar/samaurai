// TransactionHistoryScreen.tsx
import React, { useMemo, useState, useRef } from "react";
import { View, StyleSheet, Pressable, SectionList, Dimensions, Alert, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, SlideInDown, useSharedValue, useAnimatedStyle, withSpring, Layout, FadeOutUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable, GestureHandlerRootView, RectButton } from "react-native-gesture-handler";

import { useTheme } from "@/hooks/useTheme";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { isValidUpiId } from "@/services/paymentGateway";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { speak } from "../utils/speak";

import { MOCK_TRANSACTIONS, Transaction } from "@/data/transactions";

const { width } = Dimensions.get("window");

// --- HELPER FUNCTIONS ---
const getTypeIcon = (type: Transaction["type"]): keyof typeof Feather.glyphMap => {
  switch (type) {
    case "sent": return "arrow-up-right";
    case "received": return "arrow-down-left";
    case "refund": return "rotate-ccw";
    case "failed": return "x-circle";
  }
};

const getTypeColor = (type: Transaction["type"], isDark: boolean) => {
  switch (type) {
    case "sent": return KAVACHColors.sos;
    case "received": return KAVACHColors.success;
    case "refund": return KAVACHColors.info;
    case "failed": return isDark ? "#666" : "#A0A0A0";
  }
};

const getAmountPrefix = (type: Transaction["type"]) => {
  if (type === "sent") return "-";
  if (type === "received" || type === "refund") return "+";
  return "";
};

const formatTime = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const inferCategory = (tx: Transaction) => {
  const text = `${tx.note || ''} ${tx.recipient || ''} ${tx.sender || ''}`.toLowerCase();
  if (text.includes('lunch') || text.includes('food') || text.includes('restaurant') || text.includes('coffee')) return 'Food';
  if (text.includes('rent') || text.includes('housing') || text.includes('mortgage')) return 'Housing';
  if (text.includes('shop') || text.includes('e-commerce') || text.includes('order') || text.includes('store')) return 'Shopping';
  if (text.includes('electricity') || text.includes('utility') || text.includes('bill') || text.includes('internet')) return 'Utilities';
  if (text.includes('service') || text.includes('salary') || text.includes('payment')) return 'Services';
  if (tx.type === 'refund') return 'Refund';
  return 'Transfer';
};

const inferSecurityRisk = (tx: Transaction) => {
  const hour = new Date(tx.timestamp).getHours();
  const factors: string[] = [];

  let level = "Safe";
  let reason: string | null = null;
  let color = KAVACHColors.success;
  let icon = "shield";

  if (tx.amount >= 5000) {
    level = "High Risk";
    reason = "Large volume transfer";
    color = KAVACHColors.sos;
    icon = "alert-octagon";
    factors.push("Transaction volume exceeds typical velocity boundaries.");
  }
  
  if (hour >= 0 && hour <= 4) {
    level = level === "Safe" ? "Suspicious" : "High Risk";
    reason = "Unusual late-night time";
    color = level === "High Risk" ? KAVACHColors.sos : KAVACHColors.warning;
    icon = "alert-triangle";
    factors.push(`Execution logged at ${hour}:00 AM, outside active device hours.`);
  }

  if (tx.status === "failed") {
    level = "Suspicious";
    reason = "Unrecognized device origin";
    color = KAVACHColors.warning;
    icon = "shield-off";
    factors.push("Target routing node failed secondary handshake verification.");
  }

  if (level === "Safe") {
    factors.push("Location matched to trusted home network.");
    factors.push("Transfer signature validated by AI.");
  }

  return { level, reason, color, icon, factors };
};

// --- SYNTAX HIGHLIGHTING COMPONENT ---
const HighlightText = ({ text, query, defaultStyle, highlightColor }: { text: string; query: string; defaultStyle: any; highlightColor: string }) => {
  if (!query || !query.trim()) return <ThemedText style={defaultStyle} numberOfLines={1}>{text}</ThemedText>;
  
  const regex = new RegExp(`(${query})`, "gi");
  const parts = text.split(regex);
  return (
    <ThemedText style={defaultStyle} numberOfLines={1}>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <ThemedText key={index} style={[defaultStyle, { color: highlightColor, fontWeight: '900' }]}>
            {part}
          </ThemedText>
        ) : (
          <ThemedText key={index} style={defaultStyle}>
            {part}
          </ThemedText>
        )
      )}
    </ThemedText>
  );
};


// --- DATA PROCESSING AND STORY TIMELINE INJECTION ---
export type SystemActionNode = {
  isSystemAction: true;
  id: string;
  timestamp: string;
  actionType: "blocked" | "verified" | "flagged";
  message: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
};

export type PaymentPromptNode = {
  isPaymentPrompt: true;
  id: string;
  recipient: string;
  timestamp: string;
};

export type TimelineNode = Transaction | SystemActionNode | PaymentPromptNode;

const groupTransactionsByDate = (transactions: Transaction[]) => {
  const rawSorted = [...transactions].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const enhancedStream: TimelineNode[] = [];
  rawSorted.forEach(tx => {
     const risk = inferSecurityRisk(tx);
     
     if (risk.level !== "Safe") {
       let actionType: "blocked" | "verified" | "flagged" = "flagged";
       let msg = "KAVACH Intelligence analyzed anomalous activity.";
       let actColor = KAVACHColors.warning;
       let actIcon: keyof typeof Feather.glyphMap = "eye";

       if (tx.status === "failed") {
          actionType = "blocked";
          msg = "KAVACH securely blocked an unauthorized endpoint route.";
          actColor = KAVACHColors.sos;
          actIcon = "lock";
       } else if (risk.level === "High Risk") {
          actionType = "verified";
          msg = "Biometric 2FA mathematically verified for high volume.";
          actColor = KAVACHColors.info;
          actIcon = "shield";
       } else {
          actionType = "flagged";
          msg = "Heuristic scanner flagged latent background activity.";
          actColor = KAVACHColors.warning;
          actIcon = "crosshair";
       }

       enhancedStream.push({
         isSystemAction: true,
         id: `sys-${tx.id}`,
         timestamp: tx.timestamp,
         actionType,
         message: msg,
         color: actColor,
         icon: actIcon
       });
     }
     
     enhancedStream.push(tx);
  });

  const groups: { [key: string]: TimelineNode[] } = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  enhancedStream.forEach(node => {
    const nodeDate = new Date(node.timestamp).toDateString();
    let groupLabel = nodeDate;
    if (nodeDate === today) groupLabel = "Today";
    else if (nodeDate === yesterday) groupLabel = "Yesterday";

    if (!groups[groupLabel]) groups[groupLabel] = [];
    groups[groupLabel].push(node);
  });

  return Object.keys(groups).map(key => ({
    title: key,
    data: groups[key]
  }));
};

// --- TRACE MODAL BOTTOM SHEET ---
const TransactionTraceModal = ({ transaction, onClose }: { transaction: Transaction, onClose: () => void }) => {
  const { theme } = useTheme();
  const { paddingBottom } = useScreenInsets();
  const risk = inferSecurityRisk(transaction);
  
  const initDate = new Date(transaction.timestamp);
  const otpDate = new Date(initDate.getTime() + 5000); 
  const procDate = new Date(initDate.getTime() + 12000);
  const finishDate = new Date(initDate.getTime() + 18000);

  const deviceUsed = transaction.amount >= 5000 ? "Unrecognized Desktop (Win/Chrome)" : "Primary Device (iPhone 15 Pro)";
  const reqLocation = risk.level !== "Safe" ? "Unknown IP (VPN Detected)" : "Mumbai, IND (Trusted)";
  const isFailed = transaction.status === "failed";

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
       <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
             <Pressable style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>

          <Animated.View entering={SlideInDown.springify().damping(18).stiffness(150)} style={[styles.traceSheet, { backgroundColor: theme.backgroundRoot, paddingBottom: paddingBottom + Spacing.xl, borderColor: theme.border }]}>
             <View style={styles.sheetHandle} />
             
             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl }}>
               <View>
                 <ThemedText type="h3" style={{ fontWeight: '800' }}>Transaction Trace</ThemedText>
                 <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>ID: {transaction.id}</ThemedText>
               </View>

               <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: risk.color + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: risk.color + '40' }}>
                  <Feather name={risk.icon as any} size={14} color={risk.color} style={{ marginRight: 6 }} />
                  <ThemedText type="small" style={{ color: risk.color, fontWeight: '800', textTransform: 'uppercase' }}>{risk.level}</ThemedText>
               </View>
             </View>

             <View style={[styles.traceMetricsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.metricRow}>
                   <ThemedText type="caption" style={{ color: theme.textSecondary }}>Amount Escrowed</ThemedText>
                   <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>{getAmountPrefix(transaction.type)}₹{transaction.amount.toLocaleString("en-IN")}</ThemedText>
                </View>
                <View style={styles.metricRow}>
                   <ThemedText type="caption" style={{ color: theme.textSecondary }}>Counterparty Hash</ThemedText>
                   <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>{(transaction.recipient || transaction.sender || "EXTERNAL").slice(0, 8).toUpperCase()}</ThemedText>
                </View>
             </View>

             <ThemedText type="small" style={{ fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, marginTop: Spacing.lg }}>Routing Lifecycle</ThemedText>
             
             <View style={styles.stepperContainer}>
                <View style={styles.stepRow}>
                   <View style={styles.stepTrack}>
                      <View style={[styles.stepDot, { borderColor: theme.border, backgroundColor: theme.text }]} />
                      <View style={[styles.stepLine, { backgroundColor: theme.border }]} />
                   </View>
                   <View style={styles.stepContent}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>Initiated via {deviceUsed}</ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>{initDate.toLocaleString()} • {reqLocation}</ThemedText>
                   </View>
                </View>

                <View style={styles.stepRow}>
                   <View style={styles.stepTrack}>
                      <View style={[styles.stepDot, { borderColor: theme.border, backgroundColor: isFailed ? KAVACHColors.sos : KAVACHColors.info }]} />
                      <View style={[styles.stepLine, { backgroundColor: theme.border }]} />
                   </View>
                   <View style={styles.stepContent}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 16, color: isFailed ? KAVACHColors.sos : theme.text }}>
                        {isFailed ? "Biometric Verification Failed" : "OTP Handshake Verified"}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {otpDate.toLocaleString()} • {isFailed ? "Invalid signature match" : "Symmetric key registered"}
                      </ThemedText>
                   </View>
                </View>

                {!isFailed && (
                   <View style={styles.stepRow}>
                     <View style={styles.stepTrack}>
                        <View style={[styles.stepDot, { borderColor: theme.border, backgroundColor: KAVACHColors.success }]} />
                        <View style={[styles.stepLine, { backgroundColor: theme.border }]} />
                     </View>
                     <View style={styles.stepContent}>
                        <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>Network Processed</ThemedText>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>{procDate.toLocaleString()} • UPI Backbone Gateway</ThemedText>
                     </View>
                  </View>
                )}

                <View style={styles.stepRow}>
                   <View style={styles.stepTrack}>
                      <View style={[styles.stepDot, { borderColor: theme.border, backgroundColor: isFailed ? KAVACHColors.sos : theme.textSecondary, width: 14, height: 14, borderRadius: 7 }]} />
                   </View>
                   <View style={styles.stepContent}>
                      <ThemedText style={{ fontWeight: '800', fontSize: 16, color: isFailed ? KAVACHColors.sos : theme.textSecondary }}>
                        {isFailed ? "Transfer Terminated" : "Settlement Completed"}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {isFailed ? procDate.toLocaleString() : finishDate.toLocaleString()} • Session Closed
                      </ThemedText>
                   </View>
                </View>
             </View>

             {risk.reason && (
                <View style={[styles.traceXAI, { backgroundColor: risk.color + '15', borderColor: risk.color + '40' }]}>
                   <Feather name="cpu" size={16} color={risk.color} />
                   <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                     <ThemedText type="small" style={{ color: risk.color, fontWeight: '700' }}>KAVACH Reasoning</ThemedText>
                     <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>{risk.reason}</ThemedText>
                   </View>
                </View>
             )}

             <Pressable style={[styles.closeTraceBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={onClose}>
                <ThemedText style={{ fontWeight: '700', textAlign: 'center' }}>Close Investigation</ThemedText>
             </Pressable>
          </Animated.View>
       </View>
    </Modal>
  );
};

// --- TIMELINE ROW RENDERER ---
const TimelineItemRenderer = ({ node, isFirst, isLast, index, searchQuery, onTraceData }: { node: TimelineNode, isFirst: boolean, isLast: boolean, index: number, searchQuery: string, onTraceData: (tx: Transaction) => void }) => {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scale = useSharedValue(1);
  const [expanded, setExpanded] = useState(false);

  if ("isPaymentPrompt" in node) {
     return (
        <Animated.View entering={FadeInDown} style={styles.timelineRow}>
            <View style={styles.trackContainer}>
               <View style={[styles.trackLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
               <View style={[styles.trackDotCenter, { backgroundColor: theme.backgroundRoot, borderColor: KAVACHColors.primary, borderWidth: 2 }]}>
                 <Feather name="send" size={10} color={KAVACHColors.primary} />
               </View>
            </View>

            <View style={styles.timelineContent}>
               <Pressable 
                  onPress={() => {
                    console.log("Quick Pay Action:", node.recipient);
                    navigation.navigate("SendMoney", { recipient: node.recipient });
                  }}
                  style={({ pressed }) => [
                    styles.quickPayCard, 
                    { 
                      borderColor: KAVACHColors.primary, 
                      backgroundColor: KAVACHColors.primary + (pressed ? '20' : '10'),
                      zIndex: 100 
                    }
                  ]}
                >
                 <View style={{ flex: 1 }}>
                    <ThemedText style={{ color: KAVACHColors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 }}>Quick Action</ThemedText>
                    <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Pay to {node.recipient}</ThemedText>
                 </View>
                 <Feather name="zap" size={20} color={KAVACHColors.primary} />
               </Pressable>
            </View>
        </Animated.View>
     );
  }

  if ("isSystemAction" in node) {
     return (
        <Animated.View entering={FadeInDown} style={styles.timelineRow}>
            <View style={styles.trackContainer}>
               <View style={[styles.trackLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
               <View style={[styles.trackDotCenter, { backgroundColor: theme.backgroundRoot, borderColor: node.color, borderWidth: 2 }]}>
                 <View style={[StyleSheet.absoluteFill, { backgroundColor: node.color, opacity: 0.2, borderRadius: 10 }]} />
                 <Feather name={node.icon} size={10} color={node.color} />
               </View>
            </View>

            <View style={styles.timelineContent}>
               <View style={[styles.systemActionCard, { borderColor: node.color + '40', backgroundColor: node.color + '10' }]}>
                 <ThemedText style={{ color: node.color, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 }}>System {node.actionType}</ThemedText>
                 <HighlightText text={node.message} query={searchQuery} defaultStyle={{ color: theme.textSecondary, fontSize: 13 }} highlightColor={node.color} />
               </View>
            </View>
        </Animated.View>
     );
  }

  // STANDARD TRANSACTION NODE
  const tx = node as Transaction;
  const color = getTypeColor(tx.type, isDark);
  const name = tx.recipient || tx.sender || "Unknown Entity";
  const risk = inferSecurityRisk(tx);

  const handlePressIn = () => { scale.value = withSpring(0.98); };
  const handlePressOut = () => { scale.value = withSpring(1); };
  const toggleExpand = () => { setExpanded(prev => !prev); };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const renderRightActions = () => (
    <RectButton 
      style={[styles.swipeActionBase, styles.swipeRightAction, { backgroundColor: KAVACHColors.primary }]} 
      onPress={() => {
        console.log("Repeating transaction to:", name);
        navigation.navigate("SendMoney", { 
          recipient: tx.recipient || tx.sender, 
          amount: tx.amount.toString(),
          contactName: name 
        });
      }}
    >
      <Feather name="repeat" size={20} color="#FFF" />
      <ThemedText type="caption" style={{ color: '#FFF', marginTop: 4, fontWeight: '700' }}>Repeat</ThemedText>
    </RectButton>
  );

  const renderLeftActions = () => (
    <RectButton style={[styles.swipeActionBase, styles.swipeLeftAction, { backgroundColor: KAVACHColors.info }]} onPress={() => onTraceData(tx)}>
      <Feather name="activity" size={20} color="#FFF" />
      <ThemedText type="caption" style={{ color: '#FFF', marginTop: 4, fontWeight: '700' }}>Trace</ThemedText>
    </RectButton>
  );

  const dotBorderColor = risk.level !== "Safe" ? risk.color : color;

  return (
    <Animated.View entering={FadeInDown} style={styles.timelineRow}>
        <View style={styles.trackContainer}>
           <View style={[styles.trackLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', top: isFirst ? 20 : 0, bottom: isLast ? '50%' : -16 }]} />
           <View style={[styles.trackDotCenter, { backgroundColor: theme.backgroundRoot, borderColor: dotBorderColor, borderWidth: 3 }]}>
              <Feather name={getTypeIcon(tx.type)} size={12} color={dotBorderColor} />
           </View>
        </View>

        <View style={styles.timelineContent}>
            <Swipeable renderLeftActions={renderLeftActions} renderRightActions={tx.type === "sent" ? renderRightActions : undefined} friction={2}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={toggleExpand} style={{ flex: 1 }}>
                  <Animated.View style={[styles.transactionCard, { backgroundColor: theme.card, borderColor: dotBorderColor + '50' }, animatedStyle]}>
                    
                    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: dotBorderColor }} />

                    <View style={styles.contentContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                         <HighlightText 
                            text={name} 
                            query={searchQuery} 
                            defaultStyle={{ fontWeight: "700", color: theme.text, fontSize: 16, marginRight: 6 }} 
                            highlightColor={KAVACHColors.primary} 
                         />
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                         <View style={{ backgroundColor: theme.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <ThemedText type="caption" style={{ fontSize: 9, color: theme.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>
                               {inferCategory(tx)}
                            </ThemedText>
                         </View>
                         
                         <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: risk.color + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: risk.color + '40' }}>
                            <Feather name={risk.icon as any} size={10} color={risk.color} style={{ marginRight: 4 }} />
                            <ThemedText type="caption" style={{ fontSize: 9, color: risk.color, fontWeight: '800', textTransform: 'uppercase' }}>
                               {risk.level}
                            </ThemedText>
                         </View>
                      </View>

                      {risk.reason && (
                         <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <HighlightText 
                              text={`↳ ${risk.reason}`} 
                              query={searchQuery}
                              defaultStyle={{ color: risk.color, fontSize: 10 }}
                              highlightColor={risk.color}
                            />
                         </View>
                      )}
                    </View>

                    <View style={{ alignItems: "flex-end", paddingLeft: Spacing.sm }}>
                      <ThemedText style={[styles.amountText, { color: tx.type === "received" || tx.type === "refund" ? KAVACHColors.success : theme.text }]}>
                        {getAmountPrefix(tx.type)}₹{tx.amount.toLocaleString("en-IN")}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4 }}>
                        {formatTime(tx.timestamp)}
                      </ThemedText>
                    </View>
                  </Animated.View>
                </Pressable>

                {/* Independent PAY Button */}
                {searchQuery.length > 0 && (
                  <Pressable 
                    onPress={() => {
                        console.log("Direct Pay clicked:", name);
                        navigation.navigate("SendMoney", { recipient: tx.recipient || tx.sender, contactName: name });
                    }}
                    style={({ pressed }) => [
                        styles.payAgainBtn, 
                        { backgroundColor: KAVACHColors.primary, opacity: pressed ? 0.7 : 1, marginLeft: 8, elevation: 4 }
                    ]}
                  >
                      <ThemedText style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>PAY</ThemedText>
                  </Pressable>
                )}
              </View>
            </Swipeable>

            {expanded && (
               <Animated.View entering={FadeInDown.springify()} style={[styles.xaiContainer, { backgroundColor: risk.color + '0A', borderColor: dotBorderColor + '50' }]}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
                      <Feather name="cpu" size={14} color={dotBorderColor} />
                      <ThemedText type="small" style={{ color: dotBorderColor, fontWeight: '800', marginLeft: Spacing.sm, letterSpacing: 1 }}>ANALYSIS</ThemedText>
                   </View>
                   
                   {risk.factors.map((factor, idx) => (
                      <View key={`hx-${idx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                         <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotBorderColor, marginTop: 7, marginRight: 8 }} />
                         <HighlightText text={factor} query={searchQuery} defaultStyle={{ color: theme.textSecondary, flex: 1, lineHeight: 18 }} highlightColor={KAVACHColors.primary} />
                      </View>
                   ))}
               </Animated.View>
            )}
        </View>
    </Animated.View>
  );
};

// --- MAIN SCREEN ---
export default function TransactionHistoryScreen() {
  const { theme, isDark } = useTheme();
  const { paddingTop, paddingBottom } = useScreenInsets();
  
  const [filter, setFilter] = useState<"all" | "sent" | "received" | "failed">("all");
  const [tracingTx, setTracingTx] = useState<Transaction | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Core Filtering (Tabs + Smart Search)
  const filteredData = useMemo(() => {
    let data = MOCK_TRANSACTIONS.filter((tx) => {
      if (filter === "all") return true;
      if (filter === "sent") return tx.type === "sent";
      if (filter === "received") return tx.type === "received" || tx.type === "refund";
      if (filter === "failed") return tx.type === "failed";
      return true;
    });

    if (searchQuery.trim().length > 0) {
       const q = searchQuery.toLowerCase();
       data = data.filter(tx => {
          const name = (tx.recipient || tx.sender || "").toLowerCase();
          const note = (tx.note || "").toLowerCase();
          const status = tx.status.toLowerCase();
          const risk = inferSecurityRisk(tx);
          const rL = risk.level.toLowerCase();
          const rR = (risk.reason || "").toLowerCase();
          
          return name.includes(q) || note.includes(q) || status.includes(q) || rL.includes(q) || rR.includes(q);
       });
    }

    return data;
  }, [filter, searchQuery]);

  const sections = useMemo(() => {
    const baseSections = groupTransactionsByDate(filteredData);
    
    // Inject Quick Pay at the very top if search query looks like a UPI/Phone
    if (searchQuery.trim().length > 0 && isValidUpiId(searchQuery)) {
       const quickPayEntry: PaymentPromptNode = {
          isPaymentPrompt: true,
          id: "quick-pay-prompt",
          recipient: searchQuery.trim(),
          timestamp: new Date().toISOString()
       };

       // Add a special "Actions" section at the start
       return [
          { title: "Actions", data: [quickPayEntry] },
          ...baseSections
       ];
    }
    
    return baseSections;
  }, [filteredData, searchQuery]);

  // Insights Data & Intelligence Engine
  const { spentToday, netChange, insightText, insightIcon } = useMemo(() => {
    // ... [Original Logic Retained] ...
    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
    
    let sT = 0, sY = 0, nC = 0;
    let lateNightAnomalies = 0, largeTransactions = 0, sentCount = 0, receivedCount = 0;

    MOCK_TRANSACTIONS.forEach(tx => {
       const d = new Date(tx.timestamp);
       const hour = d.getHours();
       if (tx.type === "sent" && tx.status !== "failed") {
          nC -= tx.amount; sentCount++;
          if (d.toDateString() === todayStr) sT += tx.amount;
          if (d.toDateString() === yesterdayStr) sY += tx.amount;
          if (hour >= 0 && hour <= 4) lateNightAnomalies++;
          if (tx.amount >= 5000) largeTransactions++;
       }
       if ((tx.type === "received" || tx.type === "refund") && tx.status !== "failed") {
          nC += tx.amount; receivedCount++;
       }
    });

    let insight = "Your spending patterns look normal today."; let icon: keyof typeof Feather.glyphMap = "zap";
    if (largeTransactions > 0) { insight = `Unusually large outbound transaction volume detected (${largeTransactions} events).`; icon = "alert-triangle"; } 
    else if (lateNightAnomalies > 0) { insight = "Anomalous late-night activity detected between 12 AM and 4 AM."; icon = "moon"; } 
    else if (sT > sY * 1.5 && sY > 0) { insight = `You've spent ${Math.round(((sT - sY) / sY) * 100)}% more today than yesterday. Keep an eye on your budget!`; icon = "trending-up"; } 
    else if (sT < sY && sT > 0) { insight = "Great pacing! You are spending less today than yesterday."; icon = "trending-down"; } 
    else if (receivedCount > sentCount) { insight = "Your primary account activity trend is receiving funds."; icon = "arrow-down-left"; }

    return { spentToday: sT, netChange: nC, insightText: insight, insightIcon: icon };
  }, []);

  const isCyberSearch = ["suspicious", "failed", "risk", "safe", "block"].some(w => searchQuery.toLowerCase().includes(w));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop }]}>
        
        {/* Dashboard Top Header */}
      <View style={{ padding: Spacing.xl, paddingBottom: Spacing.sm }}>
         <ThemedText type="h2" style={{ fontWeight: '800', marginBottom: Spacing.lg }}>Activity Timeline</ThemedText>
         
         {/* ... [Insights Dashboard hidden during search for space] ... */}
         {!isSearchFocused && searchQuery.length === 0 && (
            <Animated.View entering={FadeInDown.delay(100)} exiting={FadeOutUp}>
                <LinearGradient colors={[isDark ? 'rgba(30,35,45,0.85)' : '#FFF', theme.card]} style={[styles.summaryCard, { borderColor: theme.border }]}>
                  <View style={styles.insightRow}>
                    <Feather name={insightIcon} size={16} color={KAVACHColors.warning} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 8, flex: 1, lineHeight: 18 }}>
                        <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>Highlights: </ThemedText>
                        {insightText}
                    </ThemedText>
                  </View>
                  <View style={styles.metricsWrapper}>
                      <View style={styles.metricBlock}>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>Spent Today</ThemedText>
                        <ThemedText type="h3" style={{ color: KAVACHColors.sos }}>₹{spentToday.toLocaleString("en-IN")}</ThemedText>
                      </View>
                      <View style={styles.metricBlock}>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>Net Change</ThemedText>
                        <ThemedText type="h3" style={{ color: netChange >= 0 ? KAVACHColors.success : theme.text }}>{netChange > 0 ? "+" : ""}₹{netChange.toLocaleString("en-IN")}</ThemedText>
                      </View>
                  </View>
                </LinearGradient>
            </Animated.View>
         )}

         {/* SEARCH BAR (Smart Filter) */}
         <View style={{ marginTop: (!isSearchFocused && searchQuery.length === 0) ? 0 : Spacing.sm }}>
            <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: isSearchFocused ? KAVACHColors.primary : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') }]}>
               <Feather name="search" size={20} color={isSearchFocused ? KAVACHColors.primary : theme.textSecondary} style={{ marginLeft: Spacing.md }} />
               <View style={{ flex: 1 }}>
                  <TextInput
                    placeholder="Search name, UPI ID, or risk level..."
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.searchInput, { color: theme.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
               </View>
               {searchQuery.length > 0 && (
                  <Pressable onPress={() => { setSearchQuery(""); Keyboard.dismiss(); }} style={{ padding: Spacing.sm, marginRight: 4, zIndex: 10 }}>
                     <Feather name="x-circle" size={18} color={theme.textSecondary} />
                  </Pressable>
               )}
            </View>
         </View>

         {/* Cyber Indicator */}
         {searchQuery.length > 0 && isCyberSearch && filteredData.length > 0 && (
            <Animated.View entering={FadeInDown} style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.sm }}>
               <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KAVACHColors.warning, marginRight: 6 }} />
               <ThemedText type="caption" style={{ color: KAVACHColors.warning, fontWeight: '700', textTransform: 'uppercase' }}>Showing Risk-Related Nodes</ThemedText>
            </Animated.View>
         )}

         {/* Segments */}
         <Animated.View entering={FadeInDown.delay(200)} layout={Layout.springify()} style={[styles.filterContainer, { marginTop: Spacing.md }]}>
            {(["all", "sent", "received", "failed"] as const).map((tab) => {
               const isActive = filter === tab;
               return (
                 <Pressable key={tab} onPress={() => setFilter(tab)} style={[styles.filterBtn, { backgroundColor: isActive ? KAVACHColors.primary : theme.border }]}>
                    <ThemedText type="caption" style={{ color: isActive ? '#FFF' : theme.text, fontWeight: isActive ? '700' : '500', textTransform: 'capitalize' }}>
                       {tab}
                    </ThemedText>
                 </Pressable>
               )
            })}
         </Animated.View>
      </View>

      <SectionList
        sections={sections}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        renderItem={({ item, index, section }) => (
           <TimelineItemRenderer 
               node={item} 
               index={index} 
               isFirst={index === 0} 
               isLast={index === section.data.length - 1} 
               searchQuery={searchQuery}
               onTraceData={setTracingTx}
            />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.sectionHeaderDot, { borderColor: theme.border }]} />
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginLeft: Spacing.xl }}>{title}</ThemedText>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: paddingBottom + 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Animated.View entering={FadeInDown} style={{ alignItems: 'center', justifyContent: 'center', padding: Spacing["2xl"], marginTop: Spacing.xl }}>
            <Feather name="search" size={48} color={theme.border} style={{ marginBottom: Spacing.md }} />
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: '700' }}>No nodes found.</ThemedText>
            {searchQuery.length > 0 && <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>Try adjusting your search criteria.</ThemedText>}
          </Animated.View>
        }
      />

      {tracingTx && (
         <TransactionTraceModal transaction={tracingTx} onClose={() => setTracingTx(null)} />
      )}

      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryCard: {
     borderRadius: BorderRadius.xl,
     borderWidth: 1,
     padding: Spacing.lg,
     marginBottom: Spacing.lg,
  },
  
  // Custom Search Input
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, height: 48 },
  searchInput: { flex: 1, paddingHorizontal: Spacing.md, fontSize: 16 },

  insightRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,200,0,0.08)', padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  metricsWrapper: { flexDirection: 'row', justifyContent: 'space-between' },
  metricBlock: { flex: 1 },
  filterContainer: { flexDirection: 'row', gap: Spacing.sm },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  
  // Section Headers
  sectionHeader: { paddingVertical: Spacing.sm, marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, flexDirection: 'row', alignItems: 'center' },
  sectionHeaderDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, position: 'absolute', left: Spacing.xl + 4, backgroundColor: '#000' },
  
  // Timeline Track Framework
  timelineRow: { flexDirection: 'row', width: '100%', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  trackContainer: { width: 24, alignItems: 'center', marginRight: Spacing.sm },
  trackLine: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1 },
  trackDotCenter: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 14, zIndex: 10 },
  timelineContent: { flex: 1, justifyContent: 'center' },
  
  // System Action Node
  systemActionCard: { padding: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, marginTop: 4, width: '90%' },
  
  // Quick Pay Card
  quickPayCard: { 
     flexDirection: 'row', 
     alignItems: 'center', 
     padding: Spacing.md, 
     borderWidth: 1, 
     borderRadius: BorderRadius.lg, 
     marginTop: 4, 
     width: '100%',
     shadowColor: KAVACHColors.primary,
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.1,
     shadowRadius: 8,
     elevation: 2,
  },

  payAgainBtn: {
     paddingHorizontal: 12,
     paddingVertical: 8,
     borderRadius: BorderRadius.sm,
     minWidth: 50,
     alignItems: 'center',
     justifyContent: 'center',
  },
  
  // Transaction Node
  transactionCard: {
     width: '100%',
     flexDirection: 'row',
     alignItems: 'center',
     padding: Spacing.md,
     borderWidth: 1,
     borderRadius: BorderRadius.lg,
     overflow: 'hidden',
  },
  contentContainer: { flex: 1, justifyContent: 'center', marginLeft: Spacing.sm },
  amountText: { fontSize: 16, fontWeight: "800" },
  
  // XAI Accordion
  xaiContainer: {
     width: '100%',
     padding: Spacing.md,
     borderWidth: 1,
     borderTopWidth: 0,
     borderBottomLeftRadius: BorderRadius.lg,
     borderBottomRightRadius: BorderRadius.lg,
     marginTop: -2, 
  },
  
  // Trace Bottom Sheet Modal
  traceSheet: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, borderTopLeftRadius: BorderRadius.xl * 1.5, borderTopRightRadius: BorderRadius.xl * 1.5, borderWidth: 1, borderBottomWidth: 0, shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.25, shadowRadius: 20 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#555', borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.xl },
  traceMetricsContainer: { flexDirection: 'row', padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, gap: Spacing.xl },
  metricRow: { flex: 1 },
  
  // Lifecycle Stepper
  stepperContainer: { paddingLeft: 4, marginTop: Spacing.sm },
  stepRow: { flexDirection: 'row', marginBottom: Spacing.xl },
  stepTrack: { alignItems: 'center', width: 20, marginRight: Spacing.md },
  stepDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 2 },
  stepLine: { width: 2, flex: 1, position: 'absolute', top: 12, bottom: -Spacing.xl, zIndex: 1 },
  stepContent: { flex: 1, marginTop: -2 },
  traceXAI: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, flexDirection: 'row', marginBottom: Spacing.xl },
  closeTraceBtn: { paddingVertical: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, alignItems: 'center' },
  
  // Gesture Handles
  swipeActionBase: { justifyContent: 'center', alignItems: 'center', width: 70, borderRadius: BorderRadius.lg, height: '100%' },
  swipeLeftAction: { marginRight: Spacing.xs },
  swipeRightAction: { marginLeft: Spacing.xs },
});
