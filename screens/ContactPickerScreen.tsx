import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Contacts from "expo-contacts";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing, BorderRadius, KAVACHColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ContactItem {
  id: string;
  name: string;
  phoneNumber: string;
}

function ContactListItem({
  contact,
  onSelect,
}: {
  contact: ContactItem;
  onSelect: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <AnimatedPressable
      onPress={onSelect}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      style={[
        styles.contactItem,
        { backgroundColor: theme.card, borderColor: theme.border },
        Shadows.sm,
        animatedStyle,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: KAVACHColors.primary + "20" }]}>
        <ThemedText style={[styles.avatarText, { color: KAVACHColors.primary }]}>
          {getInitials(contact.name)}
        </ThemedText>
      </View>
      <View style={styles.contactDetails}>
        <ThemedText style={styles.contactName}>{contact.name}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {contact.phoneNumber}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </AnimatedPressable>
  );
}

export default function ContactPickerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useLanguage();

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = contacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.phoneNumber.includes(query)
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      // Request permission
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== "granted") {
        setHasPermission(false);
        setLoading(false);
        Alert.alert(
          "Permission Required",
          "Please grant contacts permission to select contacts for payment.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Contacts.requestPermissionsAsync() },
          ]
        );
        return;
      }

      setHasPermission(true);

      // Fetch contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        // Transform contacts to our format
        const transformedContacts: ContactItem[] = [];
        let uniqueIdCounter = 0;
        
        data.forEach((contact) => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            contact.phoneNumbers.forEach((phone, phoneIndex) => {
              if (phone.number) {
                // Create a truly unique ID using counter, contact ID, and index
                const uniqueId = `contact-${contact.id || uniqueIdCounter}-phone-${phoneIndex}-${uniqueIdCounter}`;
                uniqueIdCounter++;
                
                transformedContacts.push({
                  id: uniqueId,
                  name: contact.name || "Unknown",
                  phoneNumber: phone.number.replace(/\s/g, ""),
                });
              }
            });
          }
        });

        // Sort by name
        transformedContacts.sort((a, b) => a.name.localeCompare(b.name));
        
        setContacts(transformedContacts);
        setFilteredContacts(transformedContacts);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      Alert.alert("Error", "Failed to load contacts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contact: ContactItem) => {
    // Navigate back to SendMoney screen with selected contact
    navigation.navigate("SendMoney", {
      recipient: contact.phoneNumber,
      contactName: contact.name,
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KAVACHColors.primary} />
          <ThemedText style={styles.loadingText}>Loading contacts...</ThemedText>
        </View>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyContainer}>
          <Feather name="user-x" size={64} color={theme.textSecondary} />
          <ThemedText type="h3" style={styles.emptyTitle}>
            Permission Required
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Please grant contacts permission to select contacts for payment.
          </ThemedText>
          <Pressable
            onPress={loadContacts}
            style={[styles.retryButton, { backgroundColor: KAVACHColors.primary }]}
          >
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Grant Permission
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.card }, Shadows.sm]}>
        <Feather name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search contacts..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* Contact Count */}
      <View style={styles.headerInfo}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {filteredContacts.length} {filteredContacts.length === 1 ? "contact" : "contacts"}
        </ThemedText>
      </View>

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="users" size={64} color={theme.textSecondary} />
          <ThemedText type="h3" style={styles.emptyTitle}>
            No Contacts Found
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            {searchQuery
              ? "Try a different search term"
              : "No contacts available with phone numbers"}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContactListItem contact={item} onSelect={() => handleContactSelect(item)} />
          )}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  headerInfo: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  listContainer: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
