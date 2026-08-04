import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import {
    OrientationLock,
    ReadingDirection,
    ReadingMode,
    useReaderSettingsStore,
} from '@/src/state/readerSettingsStore';
import { useAppTheme } from '@/src/theme';

const MODE_OPTIONS: { key: ReadingMode; label: string }[] = [
  { key: 'single', label: 'Página única' },
  { key: 'vertical', label: 'Vertical (webtoon)' },
];

const DIRECTION_OPTIONS: { key: ReadingDirection; label: string; description: string }[] = [
  { key: 'rtl', label: 'Estilo mangá', description: 'Avança da direita para a esquerda' },
  { key: 'ltr', label: 'Estilo ocidental', description: 'Avança da esquerda para a direita' },
];

const ORIENTATION_OPTIONS: { key: OrientationLock; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'auto', label: 'Automático', description: 'Acompanha a rotação do aparelho', icon: 'phone-portrait-outline' },
  { key: 'portrait', label: 'Retrato', description: 'Trava a tela na vertical', icon: 'phone-portrait-outline' },
  { key: 'landscape', label: 'Paisagem', description: 'Trava a tela na horizontal', icon: 'phone-landscape-outline' },
];

export default function ReadingSettingsScreen() {
  const { colors } = useAppTheme();
  const {
    mode,
    direction,
    keepAwake,
    orientationLock,
    hydrate,
    setMode,
    setDirection,
    setKeepAwake,
    setOrientationLock,
  } = useReaderSettingsStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Leitura' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Modo de leitura</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {MODE_OPTIONS.map((option, index) => (
            <Pressable
              key={option.key}
              style={[
                styles.cardRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
              onPress={() => setMode(option.key)}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
              {mode === option.key ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
              )}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Direção de leitura</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {DIRECTION_OPTIONS.map((option, index) => (
            <Pressable
              key={option.key}
              style={[
                styles.cardRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
              onPress={() => setDirection(option.key)}>
              <View style={styles.optionTextGroup}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>{option.description}</Text>
              </View>
              {direction === option.key ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
              )}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Orientação da tela</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {ORIENTATION_OPTIONS.map((option, index) => (
            <Pressable
              key={option.key}
              style={[
                styles.cardRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
              onPress={() => setOrientationLock(option.key)}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={option.icon} size={18} color={colors.text} />
              </View>
              <View style={styles.optionTextGroup}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>{option.description}</Text>
              </View>
              {orientationLock === option.key ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
              )}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Tela</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Manter tela ligada ao ler</Text>
            <Switch value={keepAwake} onValueChange={setKeepAwake} />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextGroup: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionSubLabel: {
    fontSize: 12,
  },
});
