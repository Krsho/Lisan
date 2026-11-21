import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../theme/colors';

type Props = {
  /** The header's position text, e.g. "Al-Baqarah · 5 / 286". */
  title: string;
  ayahCount: number;
  /** The ayah on screen, marked in the list. */
  current: number;
  onJump: (ayah: number) => void;
};

/** The header title; tapping it lists the surah's ayahs to jump to any of them. */
export function JumpToAyah({ title, ayahCount, current, onJump }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const ayahs = Array.from({ length: ayahCount }, (_, i) => i + 1);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. Jump to an ayah`}
        onPress={() => setOpen(true)}
        hitSlop={8}
      >
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title} ▾
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: Math.max(16, insets.bottom),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Jump to ayah</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={ayahs}
            keyExtractor={String}
            numColumns={6}
            initialNumToRender={60}
            initialScrollIndex={Math.floor((current - 1) / 6)}
            getItemLayout={(_, row) => ({ length: CELL, offset: CELL * row, index: row })}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item: ayah }) => {
              const here = ayah === current;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ayah ${ayah}`}
                  accessibilityState={{ selected: here }}
                  onPress={() => {
                    setOpen(false);
                    onJump(ayah);
                  }}
                  style={[
                    styles.cell,
                    { borderColor: colors.border },
                    here && { backgroundColor: colors.accent },
                  ]}
                >
                  <Text
                    style={[styles.cellText, { color: here ? colors.background : colors.text }]}
                  >
                    {ayah}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

/** The height of a row of ayah numbers, for scrolling to the current one. */
const CELL = 52;

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    maxHeight: '60%',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600' },
  // A sixth of the row each, so a short last row keeps the same size of cell.
  cell: {
    width: '15.3%',
    height: CELL - 6,
    marginHorizontal: '0.7%',
    marginVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cellText: { fontSize: 16 },
});
