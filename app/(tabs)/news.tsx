import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { fetchFeedItems, type FeedItem } from '@/src/services/news/rssService';
import { useNewsFeedStore } from '@/src/state/newsFeedStore';
import { useAppTheme } from '@/src/theme';

interface NewsListItem extends FeedItem {
  source: string;
}

function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatDate(pubDate: string | null): string | null {
  if (!pubDate) return null;
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NewsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { feeds, hydrated, hydrate, markAllSeen } = useNewsFeedStore();
  const [items, setItems] = useState<NewsListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (feeds.length === 0) {
        setItems([]);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled(feeds.map((url) => fetchFeedItems(url)));
        const merged: NewsListItem[] = [];
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const source = sourceFromUrl(feeds[index]);
            merged.push(...result.value.map((item) => ({ ...item, source })));
          }
        });
        if (merged.length === 0 && results.every((r) => r.status === 'rejected')) {
          setError('Não foi possível carregar os feeds. Verifique os endereços em Ajustes.');
        }
        merged.sort((a, b) => new Date(b.pubDate ?? 0).getTime() - new Date(a.pubDate ?? 0).getTime());
        setItems(merged);
        // Newest item is now visible on screen — clear the News tab badge.
        if (merged.length > 0 && merged[0].pubDate) markAllSeen(merged[0].pubDate);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [feeds, markAllSeen]
  );

  useEffect(() => {
    if (hydrated) void load(false);
  }, [hydrated, load]);

  const listKey = useMemo(() => feeds.join('|'), [feeds]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Notícias
        </Text>
        <Pressable hitSlop={8} style={[styles.configButton, { borderColor: colors.border }]} onPress={() => router.push('/settings/news')}>
          <Ionicons name="settings-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      {!hydrated || (loading && items.length === 0) ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : feeds.length === 0 ? (
        <EmptyState
          title="Nenhum feed adicionado"
          description="Toque no ícone de configurações para adicionar um feed RSS e acompanhar notícias por aqui."
        />
      ) : (
        <FlatList
          key={listKey}
          data={items}
          keyExtractor={(item, index) => `${item.link}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                title={error ? 'Erro ao carregar' : 'Nenhuma notícia encontrada'}
                description={error ?? 'Os feeds adicionados não retornaram nenhum item.'}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.newsRow, { borderColor: colors.border }]}
              onPress={() => void WebBrowser.openBrowserAsync(item.link)}>
              <View style={[styles.newsThumbWrap, { backgroundColor: colors.surfaceAlt }]}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.newsThumb} contentFit="cover" />
                ) : (
                  <Ionicons name="newspaper-outline" size={20} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.newsTextGroup}>
                <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={[styles.newsDescription, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.newsMetaRow}>
                  <Text style={[styles.newsMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.source}
                  </Text>
                  {formatDate(item.pubDate) ? (
                    <Text style={[styles.newsMeta, { color: colors.textMuted }]}>{formatDate(item.pubDate)}</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '700',
  },
  configButton: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    marginTop: 32,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  newsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  newsThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  newsThumb: {
    width: '100%',
    height: '100%',
  },
  newsTextGroup: {
    flex: 1,
    gap: 6,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  newsDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  newsMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  newsMeta: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
