import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme/colors";

interface PlaceholderScreenProps {
  emoji: string;
  title: string;
  body: string;
}

export default function PlaceholderScreen({ emoji, title, body }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    justifyContent: "flex-start"
  },
  card: {
    marginTop: 40,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 28,
    alignItems: "center"
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent,
    marginBottom: 8
  },
  body: {
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: "center"
  }
});
