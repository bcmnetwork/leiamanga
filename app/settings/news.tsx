import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { useNewsFeedStore } from '@/src/state/newsFeedStore';
import { useAppTheme } from '@/src/theme';

// Suggestions the user can opt into — never added automatically.
const SUGGESTED_FEEDS: { label: string; url: string }[] = [
  { label: 'SekaiVerse', url: 'https://sekaiverse.com/rss' },
];

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function NewsSettingsScreen() {
  const { colors } = useAppTheme();
  const { feeds, hydrate, addFeed, removeFeed } = useNewsFeedStore();
  const [newFeedUrl, setNewFeedUrl] = useState('');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function handleAddFeed(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      Alert.alert('Endereço inválido', 'Informe um link RSS completo, começando com http:// ou https://.');
      return;
    }
    addFeed(trimmed);
    setNewFeedUrl('');
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Notícias' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Adicionar feed RSS</Text>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceAlt }]}
            value={newFeedUrl}
            onChangeText={setNewFeedUrl}
            placeholder="https://exemplo.com/rss"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={() => handleAddFeed(newFeedUrl)}
          />
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.accent }]}
            onPress={() => handleAddFeed(newFeedUrl)}>
            <Ionicons name="add" size={20} color={colors.background} />
          </Pressable>
        </View>

        {feeds.length > 0 ? (
          <View style={[styles.card, { borderColor: colors.border }]}>
            {feeds.map((url, index) => (
              <View
                key={url}
                style={[
                  styles.feedRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}>
                <Text style={[styles.feedUrl, { color: colors.text }]} numberOfLines={1}>
                  {url}
                </Text>
                <Pressable hitSlop={10} onPress={() => removeFeed(url)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            Nenhum feed adicionado ainda. Cole o link RSS de um site acima.
          </Text>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Sugestões</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {SUGGESTED_FEEDS.map((suggestion, index) => {
            const added = feeds.includes(suggestion.url);
            return (
              <View
                key={suggestion.url}
                style={[
                  styles.feedRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}>
                <View style={styles.suggestionTextGroup}>
                  <Text style={[styles.feedLabel, { color: colors.text }]}>{suggestion.label}</Text>
                  <Text style={[styles.feedUrl, { color: colors.textMuted }]} numberOfLines={1}>
                    {suggestion.url}
                  </Text>
                </View>
                <Pressable
                  hitSlop={10}
                  disabled={added}
                  onPress={() => handleAddFeed(suggestion.url)}>
                  <Ionicons
                    name={added ? 'checkmark-circle' : 'add-circle-outline'}
                    size={22}
                    color={added ? colors.accent : colors.text}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Provedores parceiros</Text>
        <View style={[styles.card, styles.partnersCard, { borderColor: colors.border }]}>
          <Ionicons name="time-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.partnersText, { color: colors.textMuted }]}>
            Em breve uma lista de sites parceiros vai aparecer aqui para você adicionar com um toque. Por
            enquanto, use o campo acima para adicionar qualquer feed RSS manualmente.
          </Text>
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
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    marginHorizontal: 16,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedUrl: {
    flex: 1,
    fontSize: 13,
  },
  suggestionTextGroup: {
    flex: 1,
    gap: 2,
  },
  feedLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  partnersCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  partnersText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
