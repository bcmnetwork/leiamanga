import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Resume point: prefer a chapter left mid-read; otherwise the next unread
  // chapter (by sort order) after the last one finished.
  const continueTarget = useMemo(() => {
    if (chapters.length === 0) return null;
    const withProgress = chapters.map((c) => ({
      chapter: c,
      progress: c.page_count > 0 ? c.last_page / c.page_count : 0,
    }));
    const inProgress = withProgress
      .filter((c) => c.progress > 0 && c.progress < 0.9)
      .sort((a, b) => b.chapter.sort_order - a.chapter.sort_order)[0];
    if (inProgress) return inProgress.chapter;

    const completedOrders = withProgress.filter((c) => c.progress >= 0.9).map((c) => c.chapter.sort_order);
    if (completedOrders.length > 0) {
      const lastCompleted = Math.max(...completedOrders);
      const next = [...chapters].sort((a, b) => a.sort_order - b.sort_order).find((c) => c.sort_order > lastCompleted);
      if (next) return next;
    }
    return null;
  }, [chapters]);

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
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
              {series?.title}
            </Text>
            <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/series/edit/[id]', params: { id: id! } })}>
              <Ionicons name="create-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          {series?.genre ? (
            <View style={[styles.genreBadge, { borderColor: colors.border }]}>
              <Text style={[styles.genreBadgeText, { color: colors.textMuted }]}>{series.genre}</Text>
            </View>
          ) : null}
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

      {series?.description ? (
        <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={6}>
          {series.description}
        </Text>
      ) : null}

      {continueTarget ? (
        <Pressable
          style={[styles.continueButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push(`/reader/${continueTarget.id}`)}>
          <Ionicons name="play" size={16} color={colors.background} />
          <Text style={[styles.continueButtonText, { color: colors.background }]}>
            Continuar: {continueTarget.title}
          </Text>
        </Pressable>
      ) : null}

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  genreBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  genreBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favoriteText: {
    fontSize: 13,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 16,
    marginTop: 12,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  continueButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
