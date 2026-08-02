import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii } from "../theme/colors";
import type { Entry } from "../db/entries";
import type { TileConfig } from "../tiles";

interface EditModalProps {
  visible: boolean;
  tile: TileConfig | null;
  entry: Entry | null;
  statuses: string[];
  onSave: (patch: { status: string; note: string }) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export default function EditModal({ visible, tile, entry, statuses, onSave, onDelete, onCancel }: EditModalProps) {
  if (!visible || !tile || !entry) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <EditForm tile={tile} entry={entry} statuses={statuses} onSave={onSave} onDelete={onDelete} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EditForm({
  tile,
  entry,
  statuses,
  onSave,
  onDelete
}: {
  tile: TileConfig;
  entry: Entry;
  statuses: string[];
  onSave: (patch: { status: string; note: string }) => void;
  onDelete?: () => void;
}) {
  const [status, setStatus] = useState(entry.status ?? statuses[0] ?? "normal");
  const [note, setNote] = useState(entry.note ?? "");

  return (
    <View>
      <Text style={styles.title}>
        {entry.id ? "Edit" : "Log"} {tile.label}
      </Text>

      {statuses.length > 0 && (
        <View style={styles.pillRow}>
          {statuses.map((s) => (
            <Pressable key={s} style={[styles.pill, status === s && styles.pillSelected]} onPress={() => setStatus(s)}>
              <Text style={[styles.pillText, status === s && styles.pillTextSelected]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        style={styles.textInput}
        placeholder="Add an optional note..."
        placeholderTextColor={colors.inkSoft}
        value={note}
        onChangeText={setNote}
        multiline
      />

      <View style={styles.actions}>
        {onDelete && (
          <Pressable style={styles.btnDanger} onPress={onDelete}>
            <Text style={styles.btnDangerText}>Delete</Text>
          </Pressable>
        )}
        <Pressable style={styles.btnPrimary} onPress={() => onSave({ status, note })}>
          <Text style={styles.btnPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31,58,61,0.35)",
    justifyContent: "flex-end"
  },
  card: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent,
    marginBottom: 16
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14
  },
  pill: {
    borderWidth: 1,
    borderColor: "rgba(14,107,154,0.18)",
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  pillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft
  },
  pillTextSelected: {
    color: colors.white
  },
  textInput: {
    borderWidth: 1,
    borderColor: "rgba(14,107,154,0.18)",
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 16
  },
  actions: {
    flexDirection: "row",
    gap: 10
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 13,
    alignItems: "center"
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15
  },
  btnDanger: {
    flex: 1,
    backgroundColor: colors.highlight,
    borderRadius: radii.sm,
    paddingVertical: 13,
    alignItems: "center"
  },
  btnDangerText: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 15
  }
});
