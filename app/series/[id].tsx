import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { pickAndImportCbzFiles } from '@/src/cbz/importCbz';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { deleteDownloadedChapter } from '@/src/db/libraryMaintenance';
import { getSeriesById, listChaptersForSeries, setChapterCompleted, toggleFavorite } from '@/src/db/repository';
import type { ChapterWithProgress, SeriesRow } from '@/src/db/types';
import { redownloadChapterFiles } from '@/src/services/contentProvider/downloadChapter';
import { useContentProviderStore } from '@/src/state/contentProviderStore';
import { useAppTheme } from '@/src/theme';

const DESCRIPTION_COLLAPSE_THRESHOLD = 180;

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useContentProviderStore();
  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [chapters, setChapters] = useState<ChapterWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [redownloadingId, setRedownloadingId] = useState<string | null>(null);
  const [importingChapter, setImportingChapter] = useState(false);

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
    Alert.alert('Remover do dispositivo?', `"${chapter.title}" será removido do dispositivo. Seu histórico de leitura será mantido${chapter.source_uri.startsWith('provider:') ? ' e o capítulo poderá ser baixado novamente' : ''}.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
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

  async function handleOpenChapter(chapter: ChapterWithProgress) {
    if (chapter.downloaded) {
      router.push(`/reader/${chapter.id}`);
      return;
    }
    const prefix = session ? `provider:${session.domain}:` : null;
    if (!session || !prefix || !chapter.source_uri.startsWith(prefix)) {
      Alert.alert(
        'Capítulo não disponível',
        'Este capítulo foi removido do dispositivo e não há um provedor conectado para baixá-lo novamente.'
      );
      return;
    }
    setRedownloadingId(chapter.id);
    try {
      await redownloadChapterFiles(session, chapter);
      await load();
      router.push(`/reader/${chapter.id}`);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível baixar o capítulo novamente.');
    } finally {
      setRedownloadingId(null);
    }
  }

  async function handleToggleReadChapter(chapter: ChapterWithProgress) {
    await setChapterCompleted(chapter.id, chapter.completed === 0);
    await load();
  }

  async function handleAddChapter() {
    if (!id) return;
    setImportingChapter(true);
    try {
      const result = await pickAndImportCbzFiles(id);
      if (result.imported > 0) await load();
      if (result.imported > 0 || result.failed > 0) {
        Alert.alert(
          'Importação concluída',
          `${result.imported} capítulo(s) importado(s)${result.failed ? `, ${result.failed} falharam` : ''}.`
        );
      }
    } catch {
      Alert.alert('Erro ao importar', 'Não foi possível abrir o seletor de arquivos. Tente novamente.');
    } finally {
      setImportingChapter(false);
    }
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
            <View style={styles.genreRow}>
              {series.genre.split(',').map((g) => g.trim()).filter(Boolean).map((g) => (
                <View key={g} style={[styles.genreBadge, { borderColor: colors.border }]}>
                  <Text style={[styles.genreBadgeText, { color: colors.textMuted }]}>{g}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {series?.author ? (
            <Text style={[styles.authorText, { color: colors.textMuted }]} numberOfLines={1}>
              Autor: {series.author}
            </Text>
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
        <View style={styles.descriptionWrap}>
          <Text
            style={[styles.description, { color: colors.textMuted }]}
            numberOfLines={descriptionExpanded ? undefined : 4}>
            {series.description}
          </Text>
          {series.description.length > DESCRIPTION_COLLAPSE_THRESHOLD ? (
            <Pressable onPress={() => setDescriptionExpanded((v) => !v)}>
              <Text style={[styles.readMore, { color: colors.accent }]}>
                {descriptionExpanded ? 'Ler menos' : 'Ler mais'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {continueTarget ? (
        <Pressable
          style={[styles.continueButton, { backgroundColor: colors.accent }]}
          onPress={() => void handleOpenChapter(continueTarget)}>
          <Ionicons name="play" size={16} color={colors.background} />
          <Text style={[styles.continueButtonText, { color: colors.background }]}>
            Continuar: {continueTarget.title}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {chapters.length} {chapters.length === 1 ? 'capítulo' : 'capítulos'}
        </Text>
        <Pressable
          style={[styles.addChapterButton, { borderColor: colors.border }]}
          disabled={importingChapter}
          onPress={() => void handleAddChapter()}>
          {importingChapter ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
          )}
          <Text style={[styles.addChapterButtonText, { color: colors.accent }]}>Enviar CBZ</Text>
        </Pressable>
      </View>

      <FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const progress = item.page_count > 0 ? item.last_page / item.page_count : 0;
          const isRead = item.completed === 1 || progress >= 0.9;
          const isProviderLinked = session ? item.source_uri.startsWith(`provider:${session.domain}:`) : false;

          if (!item.downloaded) {
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.chapterRow,
                  { borderColor: colors.border },
                  pressed && styles.chapterRowPressed,
                ]}
                onPress={() => void handleOpenChapter(item)}
                onLongPress={() => handleDeleteChapter(item)}>
                <View style={styles.chapterInfo}>
                  <Text style={[styles.chapterTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                    {isProviderLinked ? 'Removido do dispositivo · toque para baixar novamente' : 'Não disponível para leitura'}
                  </Text>
                </View>
                {redownloadingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons
                    name={isProviderLinked ? 'cloud-download-outline' : 'cloud-offline-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                )}
              </Pressable>
            );
          }

          return (
            <Pressable
              style={({ pressed }) => [
                styles.chapterRow,
                { borderColor: colors.border },
                pressed && styles.chapterRowPressed,
              ]}
              onPress={() => void handleOpenChapter(item)}
              onLongPress={() => handleDeleteChapter(item)}>
              <View style={styles.chapterInfo}>
                <Text style={[styles.chapterTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                  {item.page_count} páginas
                  {item.last_page > 0 ? ` · pág. ${item.last_page}` : ''}
                  {isRead ? ' · Lido' : ''}
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
              <Pressable hitSlop={8} onPress={() => void handleToggleReadChapter(item)}>
                <Ionicons
                  name={isRead ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={20}
                  color={isRead ? colors.accent : colors.textMuted}
                />
              </Pressable>
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
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
  authorText: {
    fontSize: 12,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favoriteText: {
    fontSize: 13,
  },
  descriptionWrap: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  readMore: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addChapterButtonText: {
    fontSize: 12,
    fontWeight: '700',
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
