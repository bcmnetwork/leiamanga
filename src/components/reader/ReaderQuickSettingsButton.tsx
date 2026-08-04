import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingDirection, ReadingMode } from '@/src/state/readerSettingsStore';

interface ReaderQuickSettingsButtonProps {
  mode: ReadingMode;
  direction: ReadingDirection;
  onChangeMode: (mode: ReadingMode) => void;
  onChangeDirection: (direction: ReadingDirection) => void;
  overlayColor: string;
}

/** Gear button in the reader's top bar to switch reading mode/direction without leaving the reader. */
export function ReaderQuickSettingsButton({
  mode,
  direction,
  onChangeMode,
  onChangeDirection,
  overlayColor,
}: ReaderQuickSettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable hitSlop={8} onPress={() => setOpen((v) => !v)}>
        <Ionicons name="options-outline" size={22} color="#fff" />
      </Pressable>
      {open ? (
        <View style={[styles.panel, { backgroundColor: overlayColor }]}>
          <Text style={styles.label}>Modo de leitura</Text>
          <View style={styles.segmentRow}>
            <Pressable
              style={[styles.segment, mode === 'vertical' && styles.segmentActive]}
              onPress={() => {
                onChangeMode('vertical');
                setOpen(false);
              }}>
              <Ionicons name="swap-vertical" size={14} color="#fff" />
              <Text style={styles.segmentText}>Rolagem</Text>
            </Pressable>
            <Pressable
              style={[styles.segment, mode === 'single' && styles.segmentActive]}
              onPress={() => {
                onChangeMode('single');
                setOpen(false);
              }}>
              <Ionicons name="albums-outline" size={14} color="#fff" />
              <Text style={styles.segmentText}>Página</Text>
            </Pressable>
          </View>
          {mode === 'single' ? (
            <>
              <Text style={styles.label}>Direção</Text>
              <View style={styles.segmentRow}>
                <Pressable
                  style={[styles.segment, direction === 'rtl' && styles.segmentActive]}
                  onPress={() => {
                    onChangeDirection('rtl');
                    setOpen(false);
                  }}>
                  <Text style={styles.segmentText}>Dir → Esq</Text>
                </Pressable>
                <Pressable
                  style={[styles.segment, direction === 'ltr' && styles.segmentActive]}
                  onPress={() => {
                    onChangeDirection('ltr');
                    setOpen(false);
                  }}>
                  <Text style={styles.segmentText}>Esq → Dir</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 32,
    right: 0,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    width: 200,
    zIndex: 10,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
