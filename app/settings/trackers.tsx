import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { useAppTheme } from '@/src/theme';

export default function TrackersSettingsScreen() {
  const { colors } = useAppTheme();

  function handleConnectMyAnimeList() {
    Alert.alert(
      'Em breve',
      'A conexão com o MyAnimeList ainda está em desenvolvimento. Mais rastreadores de leitura serão adicionados em atualizações futuras.'
    );
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Rastreadores' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Rastreadores de leitura</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Pressable style={styles.cardRow} onPress={handleConnectMyAnimeList}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="list-outline" size={18} color={colors.text} />
            </View>
            <View style={styles.optionTextGroup}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>MyAnimeList</Text>
              <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>
                Sincronize seu progresso de leitura automaticamente
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.badgeText, { color: colors.textMuted }]}>Em breve</Text>
            </View>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Mais opções de rastreadores serão adicionadas em breve.
        </Text>
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 24,
    lineHeight: 16,
  },
});
