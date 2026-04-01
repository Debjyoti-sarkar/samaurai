import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  GestureResponderEvent,
  TextInput,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import Animated, { FadeIn, FadeInDown, SlideOutDown, FadeOut } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const {
    voiceGuideEnabled,
    toggleVoiceGuide,
    userData,
    updateUserProfile,
    logout,
    beginExternalAuthFlow,
    endExternalAuthFlow,
  } = useAuth();

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

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);

  useEffect(() => {
    const loadSavedProfilePhoto = async () => {
      try {
        const savedPhotoUri = await AsyncStorage.getItem("@kavach_profile_photo");
        if (savedPhotoUri) {
          setPhotoUri(savedPhotoUri);
        }
      } catch (error) {
        console.warn("Failed to load profile photo", error);
      }
    };

    loadSavedProfilePhoto();
  }, []);

  const handleTakePhoto = async () => {
    beginExternalAuthFlow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Camera permission needed");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri || (result as any).uri;
        if (uri) {
          setPhotoUri(uri);
          await AsyncStorage.setItem("@kavach_profile_photo", uri);
          setIsPhotoModalVisible(false);
        }
      }
    } finally {
      endExternalAuthFlow();
    }
  };

  const handleChooseFromGallery = async () => {
    beginExternalAuthFlow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Gallery permission needed");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri || (result as any).uri;
        if (uri) {
          setPhotoUri(uri);
          await AsyncStorage.setItem("@kavach_profile_photo", uri);
          setIsPhotoModalVisible(false);
        }
      }
    } finally {
      endExternalAuthFlow();
    }
  };

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

  // Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [name, setName] = useState(userData?.name || "User");
  const [email, setEmail] = useState(userData?.email || "");
  const [upiId, setUpiId] = useState(userData?.upiId || "");
  const [alertSensitivity, setAlertSensitivity] = useState(true);

  // Form Validation
  const [errors, setErrors] = useState<{ upiId?: string; email?: string }>({});

  const validateForm = () => {
    let isValid = true;
    let newErrors: { upiId?: string; email?: string } = {};

    if (upiId && !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i.test(upiId.trim())) {
      newErrors.upiId = "Invalid UPI ID format (e.g., name@bank)";
      isValid = false;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Invalid email address";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    
    // Simulate short network latency then update global state securely
    await new Promise(resolve => setTimeout(resolve, 800));
    await updateUserProfile(name, upiId, email);
    
    setIsSaving(false);
    setSaveSuccess(true);
    
    // Auto close after success
    setTimeout(() => {
      setSaveSuccess(false);
      setIsEditing(false);
    }, 1500);
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
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsPhotoModalVisible(true)}
          style={[
            styles.avatar,
            {
              backgroundColor: photoUri ? "transparent" : KAVACHColors.primary,
              borderWidth: photoUri ? 2 : 0,
              borderColor: photoUri ? "#6C63FF" : "transparent",
              overflow: "hidden",
            },
          ]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <ThemedText style={styles.avatarText}>{(userData?.name || "User").charAt(0).toUpperCase()}</ThemedText>
          )}
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <ThemedText type="h4">{userData?.name || "User"}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {userData?.phoneNumber ? `+91 ${userData.phoneNumber}` : "+91 9876543210"}
          </ThemedText>
        </View>
        <Pressable onPress={() => setIsEditing(true)} style={[styles.editButton, { borderColor: theme.border }]}>
          <Feather name="edit-2" size={16} color={theme.text} />
        </Pressable>
      </View>

      {/* INTELLIGENCE STATUS CARD */}
      <View style={[styles.intelligenceCard, { backgroundColor: KAVACHColors.success + "10", borderColor: KAVACHColors.success + "30" }]}>
        <View style={styles.intelligenceHeader}>
          <Feather name="shield" size={18} color={KAVACHColors.success} />
          <ThemedText style={{ color: KAVACHColors.success, fontWeight: "800", marginLeft: Spacing.sm, letterSpacing: 0.5 }}>
            LOW RISK ACCOUNT
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
          Kavach AI confirms your recent network activity and biometric patterns map exactly to your trusted devices and geographical zones.
        </ThemedText>
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
            icon="monitor"
            title="Device Management"
            subtitle="1 active trusted device"
            onPress={() => {}}
          />
          <SettingsItem
            icon="bell"
            title="High Sensitivity Alerts"
            subtitle="Trigger alerts for minor anomalies"
            rightElement={
              <Switch
                value={alertSensitivity}
                onValueChange={setAlertSensitivity}
                trackColor={{ false: theme.border, true: KAVACHColors.primary + "60" }}
                thumbColor={alertSensitivity ? KAVACHColors.primary : theme.backgroundSecondary}
              />
            }
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

      <Modal
        visible={isPhotoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPhotoModalVisible(false)}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity style={styles.photoModalBackdrop} activeOpacity={1} onPress={() => setIsPhotoModalVisible(false)} />
          <Animated.View
            entering={FadeInDown.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.photoModalContent, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
          >
            <ThemedText type="h3" style={styles.photoModalTitle}>
              Update Profile Photo
            </ThemedText>

            <Pressable style={styles.photoModalOption} onPress={handleTakePhoto}>
              <View style={styles.photoModalOptionIcon}>
                <Feather name="camera" size={18} color={KAVACHColors.primary} />
              </View>
              <ThemedText style={styles.photoModalOptionText}>Take Photo</ThemedText>
            </Pressable>

            <Pressable style={styles.photoModalOption} onPress={handleChooseFromGallery}>
              <View style={styles.photoModalOptionIcon}>
                <Feather name="image" size={18} color={KAVACHColors.primary} />
              </View>
              <ThemedText style={styles.photoModalOptionText}>Choose from Gallery</ThemedText>
            </Pressable>

            <Pressable style={styles.photoModalCancel} onPress={() => setIsPhotoModalVisible(false)}>
              <ThemedText style={styles.photoModalCancelText}>Cancel</ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={isEditing} transparent animationType="none" onRequestClose={() => !isSaving && setIsEditing(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
             <Pressable style={{ flex: 1 }} onPress={() => !isSaving && setIsEditing(false)} />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(300)} exiting={SlideOutDown} style={[styles.modalContent, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Edit Profile</ThemedText>
              <Pressable onPress={() => !isSaving && setIsEditing(false)} style={styles.closeButton}>
                 <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="caption" style={[styles.inputLabel, { color: theme.textSecondary }]}>FULL NAME</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                 <Feather name="user" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: theme.text }]}
                   value={name}
                   onChangeText={setName}
                   placeholder="Your full name"
                   placeholderTextColor={theme.textSecondary}
                   editable={!isSaving}
                 />
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="caption" style={[styles.inputLabel, { color: theme.textSecondary }]}>PHONE NUMBER</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border, opacity: 0.7 }]}>
                 <Feather name="phone" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: theme.textSecondary }]}
                   value={userData?.phoneNumber ? `+91 ${userData.phoneNumber}` : "+91 9876543210"}
                   editable={false}
                 />
                 <Feather name="lock" size={16} color={theme.textSecondary} style={{ marginRight: Spacing.md }} />
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>Phone number is linked securely and cannot be changed.</ThemedText>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="caption" style={[styles.inputLabel, { color: theme.textSecondary }]}>PREFERRED UPI ID</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: errors.upiId ? KAVACHColors.sos : theme.border }]}>
                 <Feather name="at-sign" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: theme.text }]}
                   value={upiId}
                   onChangeText={(t) => { setUpiId(t); setErrors({...errors, upiId: undefined}); }}
                   placeholder="e.g., username@bank"
                   placeholderTextColor={theme.textSecondary}
                   autoCapitalize="none"
                   editable={!isSaving}
                 />
              </View>
              {errors.upiId && <ThemedText type="caption" style={{ color: KAVACHColors.sos, marginTop: 4 }}>{errors.upiId}</ThemedText>}
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="caption" style={[styles.inputLabel, { color: theme.textSecondary }]}>EMAIL ADDRESS</ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: errors.email ? KAVACHColors.sos : theme.border }]}>
                 <Feather name="mail" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: theme.text }]}
                   value={email}
                   onChangeText={(t) => { setEmail(t); setErrors({...errors, email: undefined}); }}
                   placeholder="your@email.com"
                   placeholderTextColor={theme.textSecondary}
                   keyboardType="email-address"
                   autoCapitalize="none"
                   editable={!isSaving}
                 />
              </View>
              {errors.email && <ThemedText type="caption" style={{ color: KAVACHColors.sos, marginTop: 4 }}>{errors.email}</ThemedText>}
            </View>

            {saveSuccess ? (
              <Animated.View entering={FadeIn} style={[styles.saveFeedback, { backgroundColor: KAVACHColors.success + "20", borderColor: KAVACHColors.success }]}>
                <Feather name="check-circle" size={20} color={KAVACHColors.success} style={{ marginRight: Spacing.sm }} />
                <ThemedText style={{ color: KAVACHColors.success, fontWeight: "700" }}>Profile updated successfully!</ThemedText>
              </Animated.View>
            ) : (
              <Pressable 
                onPress={handleSaveProfile} 
                disabled={isSaving}
                style={[styles.saveButton, { backgroundColor: KAVACHColors.primary, opacity: isSaving ? 0.7 : 1 }]}
              >
                {isSaving ? (
                   <ActivityIndicator color="#FFF" size="small" />
                ) : (
                   <ThemedText style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>Save Changes</ThemedText>
                )}
              </Pressable>
            )}
            
          </Animated.View>
        </View>
      </Modal>

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
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  // Intelligence Card
  intelligenceCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  intelligenceHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing["4xl"],
    borderTopLeftRadius: BorderRadius.xl * 1.5,
    borderTopRightRadius: BorderRadius.xl * 1.5,
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    marginBottom: Spacing.xs,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    height: 52,
  },
  inputIcon: {
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    paddingRight: Spacing.md,
  },
  saveButton: {
    height: 54,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  saveFeedback: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  photoModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  photoModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  photoModalContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    borderTopLeftRadius: BorderRadius.xl * 1.5,
    borderTopRightRadius: BorderRadius.xl * 1.5,
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  photoModalTitle: {
    marginBottom: Spacing.lg,
  },
  photoModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  photoModalOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: KAVACHColors.primary + "10",
    marginRight: Spacing.md,
  },
  photoModalOptionText: {
    fontSize: 16,
  },
  photoModalCancel: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  photoModalCancelText: {
    color: KAVACHColors.sos,
    fontSize: 16,
    fontWeight: "700",
  },
});
