import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Switch,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages, Language, getTranslation } from "@/constants/i18n";
import { useTheme } from "@/hooks/useTheme";
import { useTTS } from "@/hooks/useTTS";

type RootStackParamList = {
  PhoneVerification: undefined;
  Dashboard: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LanguageSelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { language, setLanguage } = useLanguage();
  const { theme, isDark } = useTheme();
  const { speak } = useTTS();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState(true);

  const t = (key: string) => getTranslation(selectedLanguage, key);

  const handleLanguageSelect = (lang: Language) => {
    setSelectedLanguage(lang);
    if (voiceGuideEnabled) {
      const langOption = languages.find((l) => l.code === lang);
      if (langOption) {
        speak(`${langOption.name} selected`);
      }
    }
  };

  const handleContinue = () => {
    setLanguage(selectedLanguage);
    if (voiceGuideEnabled) {
      speak(t("continue"));
    }
    navigation.navigate("PhoneVerification");
  };

  const renderLanguageItem = ({ item }: { item: (typeof languages)[0] }) => {
    const isSelected = selectedLanguage === item.code;
    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          {
            backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
            borderColor: isSelected ? theme.primary : theme.border,
          },
        ]}
        onPress={() => handleLanguageSelect(item.code)}
        accessibilityLabel={`Select ${item.name}`}
        accessibilityRole="button"
      >
        <View style={styles.languageInfo}>
          <Text
            style={[
              styles.languageName,
              { color: isSelected ? "#FFFFFF" : theme.text },
            ]}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.nativeName,
              { color: isSelected ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            {item.nativeName}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.appName, { color: theme.primary }]}>
          {t("appName")}
        </Text>
        <Text style={[styles.tagline, { color: theme.text }]}>
          {t("tagline")}
        </Text>
        <Text style={[styles.taglineNative, { color: theme.textSecondary }]}>
          {t("taglineNative")}
        </Text>
      </View>

      {/* Language Selection Title */}
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t("selectLanguage")}
        </Text>
      </View>

      {/* Language List */}
      <FlatList
        data={languages}
        renderItem={renderLanguageItem}
        keyExtractor={(item) => item.code}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Voice Guide Toggle */}
      <View
        style={[styles.voiceGuideContainer, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={styles.voiceGuideInfo}>
          <Text style={[styles.voiceGuideLabel, { color: theme.text }]}>
            {t("voiceGuide")}
          </Text>
          <Text
            style={[styles.voiceGuideSubtext, { color: theme.textSecondary }]}
          >
            {t("appWillSpeak")}
          </Text>
        </View>
        <Switch
          value={voiceGuideEnabled}
          onValueChange={setVoiceGuideEnabled}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: theme.primary }]}
        onPress={handleContinue}
        accessibilityLabel={t("continue")}
        accessibilityRole="button"
      >
        <Text style={styles.continueButtonText}>{t("continue")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  appName: {
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 16,
    marginTop: 8,
  },
  taglineNative: {
    fontSize: 14,
    marginTop: 4,
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "600",
  },
  nativeName: {
    fontSize: 14,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "bold",
  },
  voiceGuideContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  voiceGuideInfo: {
    flex: 1,
  },
  voiceGuideLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  voiceGuideSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  continueButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 30,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
});
