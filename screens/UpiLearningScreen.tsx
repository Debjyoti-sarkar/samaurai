// src/screens/UpiLearningScreen.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import videosData, { VideoItem } from "@/constants/upiVideos";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/constants/i18n";
import { useTheme } from "@/hooks/useTheme";
import { useRemoteVideos } from "@/hooks/useRemoteVideos";

export default function UpiLearningScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();

  // Translation helper
  const t = (key: string) => getTranslation(language, key);

  // Fetch videos from Firestore (with fallback to local data)
  const { videos: remoteVideos, loading: loadingRemote } = useRemoteVideos();

  // Use remote videos if available, otherwise fall back to local
  const allVideos = useMemo(() => {
    return remoteVideos.length > 0 ? remoteVideos : videosData;
  }, [remoteVideos]);

  // Get ONE VIDEO ONLY for the selected language
  const video =
    allVideos.find((v) => v.lang === language) ||
    allVideos.find((v) => v.lang === "en"); // fallback

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {/* Loading indicator when fetching remote videos */}
      {loadingRemote && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading videos...
          </Text>
        </View>
      )}

      {video ? (
        <>
          <Text style={{ fontSize: 22, fontWeight: "700", color: theme.text, margin: 16 }}>
            {video.title}
          </Text>

          <YoutubePlayer
            height={230}
            play={false}
            videoId={video.id}
          />

          <Text style={{ fontSize: 14, color: theme.textSecondary, margin: 16 }}>
            Source: {video.source}
          </Text>
        </>
      ) : (
        <View style={{ padding: 20 }}>
          <Text style={{ color: theme.textSecondary }}>
            {t("noVideosAvailable")}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 20, fontWeight: "700", textAlign: "center", marginVertical: 12 },
  tabs: { flexDirection: "row", justifyContent: "space-around", marginHorizontal: 8, marginBottom: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ddd" },
  tabActive: { backgroundColor: "#EEE" },
  tabText: { fontSize: 14 },
  loadingContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 12 
  },
  loadingText: { 
    marginLeft: 8, 
    fontSize: 14 
  },
  card: { marginBottom: 16, padding: 12, borderRadius: 10, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSource: { fontSize: 12, marginTop: 6 },
  playButton: { marginTop: 10, backgroundColor: "#1976D2", padding: 8, alignSelf: "flex-start", borderRadius: 6 },
  playButtonText: { color: "#fff", fontWeight: "600" },
  playerWrapper: { marginTop: 12, borderRadius: 8, overflow: "hidden" },
});
