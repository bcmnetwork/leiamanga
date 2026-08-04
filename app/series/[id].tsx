import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { deleteDownloadedChapter } from '@/src/db/libraryMaintenance';
import { getSeriesById, listChaptersForSeries, toggleFavorite } from '@/src/db/repository';
import type { ChapterWithProgress, SeriesRow } from '@/src/db/types';
import { useAppTheme } from '@/src/theme';

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [chapters, setChapters] = useState<ChapterWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [seriesRow, chapterRows] = await Promise.all([
      getSeriesById(id),
      listChaptersForSeries(id),
    ]);
    setSeries(seriesRow);
    setChapters(chapterRows);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleFavorite() {
    if (!id) return;
    await toggleFavorite(id);
    await load();
  }

  function handleDeleteChapter(chapter: ChapterWithProgress) {
    Alert.alert('Apagar capítulo?', `"${chapter.title}" será removido do dispositivo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteDownloadedChapter(chapter.id);
            await load();
          })();
        },
      },
    ]);
  }

  if (!loading && !series) {
    return (
      <ScreenContainer topInset={false}>
        <EmptyState title="Série não encontrada" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <View style={styles.headerRow}>
        <View style={[styles.cover, { backgroundColor: colors.surfaceAlt }]}>
          {series?.cover_path ? (
            <Image source={{ uri: series.cover_path }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <Ionicons name="book-outline" size={32} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
            {series?.title}
          </Text>
          <Pressable style={styles.favoriteRow} onPress={handleToggleFavorite}>
            <Ionicons
              name={series?.favorite ? 'star' : 'star-outline'}
              size={18}
              color={series?.favorite ? '#FFD166' : colors.textMuted}
            />
            <Text style={[styles.favoriteText, { color: colors.textMuted }]}>
              {series?.favorite ? 'Favoritado' : 'Adicionar aos favoritos'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {chapters.length} {chapters.length === 1 ? 'capítulo' : 'capítulos'}
      </Text>

      <FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const progress = item.page_count > 0 ? item.last_page / item.page_count : 0;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.chapterRow,
                { borderColor: colors.border },
                pressed && styles.chapterRowPressed,
              ]}
              onPress={() => router.push(`/reader/${item.id}`)}
              onLongPress={() => handleDeleteChapter(item)}>
              <View style={styles.chapterInfo}>
                <Text style={[styles.chapterTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                  {item.page_count} páginas
                  {item.last_page > 0 ? ` · pág. ${item.last_page}` : ''}
                </Text>
              </View>
              {progress > 0 ? (
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.accent, width: `${Math.min(progress * 100, 100)}%` },
                    ]}
                  />
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cover: {
    width: 90,
    height: 130,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favoriteText: {
    fontSize: 13,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  chapterRowPressed: {
    opacity: 0.6,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  chapterMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    width: 40,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
