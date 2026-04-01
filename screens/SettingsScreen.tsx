import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Switch, Alert, GestureResponderEvent, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNexaSafe } from "@/contexts/NexaSafeContext";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

function SettingsItem({ icon, title, subtitle, onPress, rightElement, danger }: SettingsItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.settingsItem, { backgroundColor: theme.card }]}
    >
      <View style={[styles.settingsIcon, { backgroundColor: (danger ? KAVACHColors.sos : KAVACHColors.primary) + "15" }]}>
        <Feather name={icon} size={20} color={danger ? KAVACHColors.sos : KAVACHColors.primary} />
      </View>
      <View style={styles.settingsInfo}>
        <ThemedText style={[styles.settingsTitle, danger && { color: KAVACHColors.sos }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightElement ? rightElement : onPress ? (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, language, languages, setLanguage } = useLanguage();
  const { voiceGuideEnabled, toggleVoiceGuide, userData, logout } = useAuth();

  // NexaSafe tracking
  const { trackScreenVisit, trackTap, trackTapDuration, trackSwipe, isSessionActive, endSession } = useNexaSafe();

  // Tap timing refs
  const tapStartTime = useRef<number>(0);
  const scrollStartY = useRef<number>(0);
  const scrollStartTime = useRef<number>(0);

  // Track screen visit on mount
  useEffect(() => {
    if (isSessionActive) {
      trackScreenVisit('Settings');
    }
  }, [isSessionActive]);

  // Handle tap tracking
  const handleTapStart = () => {
    tapStartTime.current = Date.now();
  };

  const handleTapEnd = (e: GestureResponderEvent, zone: string = 'active') => {
    if (isSessionActive) {
      const { locationX, locationY } = e.nativeEvent;
      const duration = Date.now() - tapStartTime.current;
      trackTap('Settings', locationX, locationY, zone);
      trackTapDuration('Settings', duration);
    }
  };

  const currentLanguage = languages.find((l) => l.code === language);

  const handleLogout = () => {
    Alert.alert(
      t("logout"),
      "Are you sure you want to logout?",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("logout"),
          style: "destructive",
          onPress: async () => {
            // End NexaSafe session on logout
            await endSession();
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          },
        },
      ]
    );
  };

  const handleLanguageChange = () => {
    Alert.alert(
      t("selectLanguage"),
      "Choose your preferred language",
      languages.map((lang) => ({
        text: lang.nativeName,
        onPress: () => setLanguage(lang.code),
      }))
    );
  };

  return (
    <ScreenScrollView>
      <View style={[styles.profileCard, { backgroundColor: theme.card }, Shadows.md]}>
        <View style={[styles.avatar, { backgroundColor: KAVACHColors.primary }]}>
          <ThemedText style={styles.avatarText}>U</ThemedText>
        </View>
        <View style={styles.profileInfo}>
          <ThemedText type="h4">User</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {userData?.phoneNumber ? `+91 ${userData.phoneNumber}` : "+91 XXXXXXXXXX"}
          </ThemedText>
        </View>
        <Pressable style={[styles.editButton, { borderColor: theme.border }]}>
          <Feather name="edit-2" size={16} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          PREFERENCES
        </ThemedText>
        <View style={styles.settingsGroup}>
          <SettingsItem
            icon="globe"
            title="Language"
            subtitle={currentLanguage?.nativeName}
            onPress={handleLanguageChange}
          />
          <SettingsItem
            icon="volume-2"
            title={t("voiceGuide")}
            subtitle="Audio guidance for navigation"
            rightElement={
              <Switch
                value={voiceGuideEnabled}
                onValueChange={toggleVoiceGuide}
                trackColor={{ false: theme.border, true: KAVACHColors.primary + "60" }}
                thumbColor={voiceGuideEnabled ? KAVACHColors.primary : theme.backgroundSecondary}
              />
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          SECURITY
        </ThemedText>
        <View style={styles.settingsGroup}>
          <SettingsItem
            icon="lock"
            title="Change PIN"
            subtitle="Update your 6-digit PIN"
            onPress={() => navigation.navigate("ChangePin")}
          />
          <SettingsItem
            icon="smartphone"
            title="Biometric Authentication"
            subtitle={userData?.biometricEnabled ? "Enabled" : "Disabled"}
            onPress={() => navigation.navigate("BiometricSettings")}
          />
          <SettingsItem
            icon="credit-card"
            title="Linked Accounts"
            subtitle={userData?.bankName || "Manage your bank accounts"}
            onPress={() => navigation.navigate("Balance")}
          />
          <SettingsItem
            icon="shield"
            title="Aadhaar Verification"
            subtitle={userData?.aadhaarLinked ? "Verified" : "Not linked"}
            onPress={() => navigation.navigate("AadhaarVerification")}
          />
          <SettingsItem
            icon="activity"
            title="Security Dashboard"
            subtitle="View security alerts & risk score"
            onPress={() => navigation.navigate("SecurityDashboard")}
          />
          <SettingsItem
            icon="cpu"
            title="Behavior Analytics"
            subtitle="BAA, cursor & cognitive analysis"
            onPress={() => navigation.navigate("BehaviorAnalytics")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          SUPPORT
        </ThemedText>
        <View style={styles.settingsGroup}>
          <SettingsItem
            icon="help-circle"
            title="Help & FAQ"
            onPress={() => navigation.navigate("HelpFaq")}
          />
          <SettingsItem
            icon="message-circle"
            title="Contact Support"
            onPress={() => navigation.navigate("ContactSupport")}
          />
          <SettingsItem
            icon="file-text"
            title="Terms & Privacy"
            onPress={() => navigation.navigate("TermsPrivacy")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.settingsGroup}>
          <SettingsItem
            icon="log-out"
            title={t("logout")}
            onPress={handleLogout}
            danger
          />
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
          KAVACH v1.0.0
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
          Security in your hands
        </ThemedText>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "600",
  },
  profileInfo: {
    flex: 1,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    letterSpacing: 0.5,
  },
  settingsGroup: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    gap: 1,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingsInfo: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  footer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
