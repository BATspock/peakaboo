import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable swallows taps so touching the sheet doesn't close it */}
        <Pressable onPress={() => undefined} style={styles.sheetWrap}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.title}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text numberOfLines={1} style={styles.subtitle}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable hitSlop={8} onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
  },
  sheetWrap: { maxHeight: "92%" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 16, color: colors.textSecondary, fontWeight: "600" },
  body: { maxHeight: 600 },
  bodyContent: { padding: 20, gap: 20 },
});
