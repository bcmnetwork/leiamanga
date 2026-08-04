import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingDirection, ReadingMode } from '@/src/state/readerSettingsStore';
import { useAppTheme } from '@/src/theme';

interface ReaderQuickSettingsButtonProps {
  mode: ReadingMode;
  direction: ReadingDirection;
  onChangeMode: (mode: ReadingMode) => void;
  onChangeDirection: (direction: ReadingDirection) => void;
}

const MODE_OPTIONS: { key: ReadingMode; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'vertical', label: 'Rolagem', description: 'Páginas em sequência vertical (webtoon)', icon: 'swap-vertical' },
  { key: 'single', label: 'Página única', description: 'Uma página por vez, com deslize', icon: 'albums-outline' },
];

const DIRECTION_OPTIONS: { key: ReadingDirection; label: string; description: string }[] = [
  { key: 'rtl', label: 'Estilo mangá', description: 'Avança da direita para a esquerda' },
  { key: 'ltr', label: 'Estilo ocidental', description: 'Avança da esquerda para a direita' },
];

/** Gear button in the reader's top bar, opens a bottom-sheet to switch reading mode/direction without leaving the reader. */
export function ReaderQuickSettingsButton({
  mode,
  direction,
  onChangeMode,
  onChangeDirection,
}: ReaderQuickSettingsButtonProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable hitSlop={8} onPress={() => setOpen(true)}>
        <Ionicons name="options-outline" size={22} color="#fff" />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Ajustes de leitura</Text>
              <Pressable hitSlop={10} onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Modo de leitura</Text>
            <View style={[styles.card, { borderColor: colors.border }]}>
              {MODE_OPTIONS.map((option, index) => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.row,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}
                  onPress={() => onChangeMode(option.key)}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name={option.icon} size={20} color={colors.text} />
                  </View>
                  <View style={styles.rowTextGroup}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.rowDescription, { color: colors.textMuted }]}>{option.description}</Text>
                  </View>
                  {mode === option.key ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={colors.border} />
                  )}
                </Pressable>
              ))}
            </View>

            {mode === 'single' ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Direção de leitura</Text>
                <View style={[styles.card, { borderColor: colors.border }]}>
                  {DIRECTION_OPTIONS.map((option, index) => (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.row,
                        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      ]}
                      onPress={() => onChangeDirection(option.key)}>
                      <View style={styles.rowTextGroup}>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>{option.label}</Text>
                        <Text style={[styles.rowDescription, { color: colors.textMuted }]}>{option.description}</Text>
                      </View>
                      {direction === option.key ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color={colors.border} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextGroup: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowDescription: {
    fontSize: 12,
  },
});
