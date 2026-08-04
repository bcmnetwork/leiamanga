import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { ThemePreference, useThemeStore } from '@/src/state/themeStore';
import { useAppTheme } from '@/src/theme';

const OPTIONS: { key: ThemePreference; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'Automático (sistema)', description: 'Acompanha o tema do seu dispositivo', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Claro', description: 'Sempre usar o tema claro', icon: 'sunny-outline' },
  { key: 'dark', label: 'Escuro', description: 'Sempre usar o tema escuro', icon: 'moon-outline' },
];

export default function AppearanceSettingsScreen() {
  const { colors } = useAppTheme();
  const { preference, hydrate, setPreference } = useThemeStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Aparência' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Tema</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {OPTIONS.map((option, index) => (
            <Pressable
              key={option.key}
              style={[
                styles.cardRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
              onPress={() => setPreference(option.key)}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={option.icon} size={18} color={colors.text} />
              </View>
              <View style={styles.optionTextGroup}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>{option.description}</Text>
              </View>
              {preference === option.key ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
              )}
            </Pressable>
          ))}
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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
