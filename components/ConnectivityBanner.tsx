// components/ConnectivityBanner.tsx
import { View, Text, StyleSheet } from "react-native";

interface ConnectivityBannerProps {
  isConnected: boolean;
  isWeak: boolean;
}

export default function ConnectivityBanner({ isConnected, isWeak }: ConnectivityBannerProps) {
  if (isConnected && !isWeak) return null;

  return (
    <View style={[styles.container, { backgroundColor: isConnected ? "#FF9500" : "#FF3B30" }]}>
      <Text style={styles.text}>
        {isConnected ? "Low connectivity — voice disabled" : "Offline - using cached data"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  text: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
});
