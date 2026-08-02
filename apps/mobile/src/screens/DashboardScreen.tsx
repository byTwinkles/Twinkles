import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { QUICK_LOG_TILES, STATUS_OPTIONS, tileFor, type TileConfig } from "../tiles";
import { addEntry, deleteEntry, entriesForToday, lastEntryOfType, updateEntry, type Entry } from "../db/entries";
import { relativeTime, formatClock } from "../utils/time";
import Tile from "../components/Tile";
import EditModal from "../components/EditModal";

const EDIT_WINDOW_MS = 60 * 1000;

export default function DashboardScreen() {
  const [lastByType, setLastByType] = useState<Record<string, Entry | null>>({});
  const [today, setToday] = useState<Entry[]>([]);
  const [editTile, setEditTile] = useState<TileConfig | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  const refresh = useCallback(async () => {
    const [entries, lastEntries] = await Promise.all([
      entriesForToday(),
      Promise.all(QUICK_LOG_TILES.map((t) => lastEntryOfType(t.key)))
    ]);
    setToday(entries);
    const map: Record<string, Entry | null> = {};
    QUICK_LOG_TILES.forEach((t, i) => {
      map[t.key] = lastEntries[i];
    });
    setLastByType(map);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleTap = async (tile: TileConfig) => {
    const last = lastByType[tile.key];
    const withinEditWindow = last && Date.now() - new Date(last.timestamp).getTime() < EDIT_WINDOW_MS;
    if (withinEditWindow && last) {
      setEditTile(tile);
      setEditEntry(last);
      return;
    }
    await addEntry({ type: tile.key, timestamp: new Date().toISOString(), status: "normal" });
    await refresh();
  };

  const handleLongPress = (tile: TileConfig) => {
    setEditTile(tile);
    setEditEntry({ id: "", type: tile.key, timestamp: new Date().toISOString(), status: "normal", note: "" });
  };

  const closeEdit = () => {
    setEditTile(null);
    setEditEntry(null);
  };

  const saveEdit = async (patch: { status: string; note: string }) => {
    if (!editEntry) return;
    if (editEntry.id) {
      await updateEntry(editEntry.id, patch);
    } else {
      await addEntry({ ...editEntry, ...patch });
    }
    closeEdit();
    await refresh();
  };

  const deleteEdit = editEntry?.id
    ? async () => {
        await deleteEntry(editEntry.id);
        closeEdit();
        await refresh();
      }
    : undefined;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Good day, Romere 💙</Text>

        <Text style={styles.sectionLabel}>Quick actions</Text>
        <View style={styles.grid}>
          {QUICK_LOG_TILES.map((tile) => (
            <Tile
              key={tile.key}
              icon={tile.icon}
              label={tile.label}
              sub={lastByType[tile.key] ? relativeTime(lastByType[tile.key]!.timestamp) : undefined}
              onTap={() => handleTap(tile)}
              onLongPress={() => handleLongPress(tile)}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Today's log</Text>
        {today.length === 0 ? (
          <Text style={styles.empty}>Nothing logged yet today — tap a tile above to get started.</Text>
        ) : (
          today.map((entry) => {
            const tile = tileFor(entry.type);
            return (
              <View key={entry.id} style={styles.entryRow}>
                <Text style={styles.entryIcon}>{tile.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryType}>{tile.label}</Text>
                  <Text style={styles.entryTime}>
                    {formatClock(entry.timestamp)}
                    {entry.status && entry.status !== "normal" ? ` · ${entry.status}` : ""}
                  </Text>
                  {entry.note ? <Text style={styles.entryNote}>{entry.note}</Text> : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <EditModal
        visible={!!editEntry}
        tile={editTile}
        entry={editEntry}
        statuses={editTile ? STATUS_OPTIONS[editTile.key] ?? [] : []}
        onSave={saveEdit}
        onDelete={deleteEdit}
        onCancel={closeEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scroll: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.accent,
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.inkSoft,
    marginTop: 18,
    marginBottom: 10
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  empty: {
    color: colors.inkSoft,
    fontSize: 14,
    paddingVertical: 12
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  entryIcon: {
    fontSize: 20
  },
  entryType: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink
  },
  entryTime: {
    fontSize: 12,
    color: colors.inkSoft
  },
  entryNote: {
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2
  }
});
