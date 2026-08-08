import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii } from "../theme/colors";

interface TileProps {
  icon: string;
  label: string;
  sub?: string;
  onTap: () => void;
  onLongPress: () => void;
}

const LONG_PRESS_MS = 500;

export default function Tile({ icon, label, sub, onTap, onLongPress }: TileProps) {
  const [flash, setFlash] = useState(false);
  const longPressFired = useRef(false);

  const handlePress = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onTap();
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  };

  const handleLongPress = () => {
    longPressFired.current = true;
    onLongPress();
  };

  return (
    <Pressable
      style={[styles.tile, flash && styles.tileFlash]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={LONG_PRESS_MS}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: "31%",
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: colors.accent,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  tileFlash: {
    backgroundColor: colors.highlight
  },
  icon: {
    fontSize: 26
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    textAlign: "center"
  },
  sub: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.inkSoft
  }
});
