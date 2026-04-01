import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@expo/vector-icons";
import { Spacing, BorderRadius, KAVACHColors } from "@/constants/theme";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence, Easing, Layout, FadeIn, FadeOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSecurityIntelligence, AlertItem } from "@/contexts/SecurityIntelligenceContext";

function GlowingAlertWrapper({ item, children }: { item: AlertItem, children: React.ReactNode }) {
  const glow = useSharedValue(0.2);

  useEffect(() => {
    if (item.severity === "HIGH") {
      glow.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [item.severity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      shadowColor: KAVACHColors.sos,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glow.value,
      shadowRadius: 15,
      elevation: glow.value * 20,
    };
  });

  if (item.severity === "HIGH") {
    // Add flex: 1 and width: 100% to ensure children don't collapse
    return <Animated.View style={[animatedStyle, { width: '100%' }]}>{children}</Animated.View>;
  }

  return <View style={{ width: '100%' }}>{children}</View>;
}

export default function SecurityAlertsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const { alerts, triggerAction } = useSecurityIntelligence();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getSeverityColors = (severity: string) => {
    switch(severity) {
      case "HIGH": return { bg: KAVACHColors.sos + "20", text: KAVACHColors.sos };
      case "MEDIUM": return { bg: KAVACHColors.warning + "20", text: KAVACHColors.warning };
      case "LOW": return { bg: KAVACHColors.success + "20", text: KAVACHColors.success };
      default: return { bg: theme.card, text: theme.textSecondary };
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleAction = (action: string, id: string) => {
    toggleExpand(id); 
    triggerAction(action, id);
  };

  const renderItem = ({ item, index }: { item: AlertItem, index: number }) => {
    const colors = getSeverityColors(item.severity);
    const isExpanded = expandedId === item.id;
    
    return (
      <Animated.View 
        layout={Layout.springify()} 
        entering={FadeInDown.delay(100 * Math.min(index, 5))}
        style={{ flexDirection: 'row', marginBottom: Spacing.xl }}
      >
        {/* Vertical Timeline Graphic */}
        <View style={{ width: 44, alignItems: 'center', marginRight: Spacing.md }}>
          <View style={[styles.timelineNode, { borderColor: colors.text, backgroundColor: colors.bg }]}>
             <Feather name={item.icon as any} size={16} color={colors.text} />
             {/* Built-in timeline pulse for High Severity */}
             {item.severity === "HIGH" && (
                <View style={[StyleSheet.absoluteFill, { borderRadius: 20, backgroundColor: colors.text, opacity: 0.2 }]} />
             )}
          </View>
          {/* Continuous tracking line for the timeline */}
          {index !== alerts.length - 1 && (
             <View style={{ width: 2, flex: 1, backgroundColor: item.severity === 'HIGH' ? colors.bg : theme.border, marginTop: -4, marginBottom: -28, zIndex: 1 }} />
          )}
        </View>

        {/* Content Card payload */}
        <View style={{ flex: 1 }}>
          <GlowingAlertWrapper item={item}>
            <Pressable onPress={() => toggleExpand(item.id)}>
              <LinearGradient
                colors={[theme.card, 'rgba(30,30,40,0.6)']}
                style={[
                  styles.alertCard, 
                  { borderColor: item.severity === 'HIGH' ? KAVACHColors.sos + '70' : theme.border }
                ]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                <View style={styles.cardTop}>
                  <View style={styles.alertContent}>
                    <View style={styles.alertHeader}>
                      <ThemedText style={styles.titleText} numberOfLines={1}>{item.title}</ThemedText>
                      <ThemedText type="caption" style={styles.timestampText}>{item.timestamp}</ThemedText>
                    </View>
                    
                    <ThemedText type="small" style={styles.descText}>
                      {item.description}
                    </ThemedText>
                    
                    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                      <ThemedText type="caption" style={{ color: colors.text, fontWeight: "800", letterSpacing: 1 }}>
                        {item.severity} RISK
                      </ThemedText>
                    </View>
                  </View>
                </View>

                {/* Expandable Action Controls */}
                {isExpanded && (
                  <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.actionControls, { borderTopColor: theme.border }]}>
                    <Pressable style={styles.actionBtn} onPress={() => { toggleExpand(item.id); (navigation.navigate as any)('SecurityGraph', { alertId: item.id }); }}>
                      <Feather name="shield" size={16} color={KAVACHColors.primary} />
                      <ThemedText type="small" style={{ color: KAVACHColors.primary, marginLeft: 6, fontWeight: '700' }}>Deep Dive</ThemedText>
                    </Pressable>
                    <View style={[styles.actionVerticalDivider, { backgroundColor: theme.border }]} />
                    <Pressable style={styles.actionBtn} onPress={() => handleAction('block', item.id)}>
                      <Feather name="slash" size={16} color={KAVACHColors.warning} />
                      <ThemedText type="small" style={{ color: KAVACHColors.warning, marginLeft: 6 }}>Block</ThemedText>
                    </Pressable>
                    <View style={[styles.actionVerticalDivider, { backgroundColor: theme.border }]} />
                    <Pressable style={styles.actionBtn} onPress={() => handleAction('ignore', item.id)}>
                      <Feather name="x" size={16} color={theme.textSecondary} />
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>Ignore</ThemedText>
                    </Pressable>
                  </Animated.View>
                )}
              </LinearGradient>
            </Pressable>
          </GlowingAlertWrapper>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown} style={styles.header}>
            <ThemedText type="h2" style={{ fontWeight: "800", textTransform: 'uppercase', letterSpacing: 1 }}>Mission Feed</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Live threat intelligence notifications.</ThemedText>
          </Animated.View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { 
    padding: Spacing.xl, 
    paddingBottom: 100 
  },
  header: { 
    marginBottom: Spacing.xl 
  },
  alertCard: { 
    width: '100%', 
    borderRadius: BorderRadius.xl, 
    borderWidth: 1, 
    overflow: 'hidden' 
  },
  cardTop: { 
    flexDirection: "row", 
    padding: Spacing.lg 
  },
  timelineNode: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: 2,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  alertContent: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  alertHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    marginBottom: 4
  },
  titleText: {
    fontWeight: "700",
    flex: 1,
    marginRight: Spacing.sm
  },
  timestampText: {
    color: '#888888',
    minWidth: 60,
    textAlign: 'right'
  },
  descText: {
    color: '#aaaaaa',
    lineHeight: 20,
    marginBottom: Spacing.md
  },
  badge: { 
    alignSelf: "flex-start", 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: BorderRadius.xs 
  },
  actionControls: {
    flexDirection: 'row',
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  actionVerticalDivider: {
    width: 1,
    height: '100%',
  }
});
