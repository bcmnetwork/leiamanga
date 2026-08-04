import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { deleteDownloadedChapter } from '@/src/db/libraryMaintenance';
import {
    getChapterBySourceUri,
    listReadMarksWithPrefix,
    listSourceUrisWithPrefix,
    markSourceRead,
    unmarkSourceRead,
} from '@/src/db/repository';
import {
    addToLibrary,
    getChapters,
    getLibrary,
    getWork,
    getWorkChapterHistory,
    removeFromLibrary,
    type ProviderChapterSummary,
    type ProviderWorkDetail,
} from '@/src/services/contentProvider/ContentCatalogService';
import {
    buildProviderSourcePrefix,
    chapterIdFromSourceUri,
} from '@/src/services/contentProvider/downloadChapter';
import { useContentProviderStore } from '@/src/state/contentProviderStore';
import { downloadKey, useDownloadQueueStore } from '@/src/state/downloadQueueStore';
import { useAppTheme } from '@/src/theme';

const PUBLICATION_STATUS_LABELS: Record<string, string> = {
  ongoing: 'Em andamento',
  completed: 'Concluído',
  hiatus: 'Em hiato',
  cancelled: 'Cancelado',
};

const DESCRIPTION_COLLAPSE_THRESHOLD = 180;

export default function ProviderWorkScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useContentProviderStore();
  const { statuses, errors: queueErrors, enqueue, removeItem } = useDownloadQueueStore();

  const [work, setWork] = useState<ProviderWorkDetail | null>(null);
  const [chapters, setChapters] = useState<ProviderChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [reversed, setReversed] = useState(false);
  const [chapterQuery, setChapterQuery] = useState('');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [readNumbers, setReadNumbers] = useState<Set<number>>(new Set());
  const [manualReadIds, setManualReadIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<{ chapterNumber: string; progressPercent: number }[]>([]);

  // Serializes save/unsave calls in the order the user issued them, so a fast
  // tap-then-navigate-away doesn't let an older request finish after a newer one.
  const saveToggleSeqRef = useRef(0);
  const savePendingRef = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async () => {
    if (!session || !slug) return;
    setLoading(true);
    setError(null);
    try {
      const [workDetail, chapterList, libraryItems, history] = await Promise.all([
        getWork(session, slug),
        getChapters(session, slug),
        getLibrary(session).catch(() => []),
        getWorkChapterHistory(session, slug).catch(() => []),
      ]);
      setWork(workDetail);
      setChapters(chapterList);
      setSaved(libraryItems.some((item) => item.workSlug === workDetail.slug));
      setHistory(history);
      setReadNumbers(
        new Set(
          history.filter((h) => h.progressPercent >= 90).map((h) => Number(h.chapterNumber))
        )
      );

      const prefix = buildProviderSourcePrefix(session, workDetail.slug);
      const sourceUris = await listSourceUrisWithPrefix(prefix).catch(() => []);
      setDownloadedIds(new Set(sourceUris.map((uri) => chapterIdFromSourceUri(uri, prefix))));

      const readMarkKeys = await listReadMarksWithPrefix(prefix).catch(() => []);
      setManualReadIds(new Set(readMarkKeys.map((key) => chapterIdFromSourceUri(key, prefix))));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar esta obra.');
    } finally {
      setLoading(false);
    }
  }, [session, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Once a queued download finishes, fold it into `downloadedIds` so the row
  // shows a permanent checkmark instead of depending on queue state forever.
  useEffect(() => {
    if (!work) return;
    const doneIds = chapters
      .map((c) => c.id)
      .filter((id) => statuses[downloadKey(work.slug, id)] === 'done');
    if (doneIds.length === 0) return;
    setDownloadedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of doneIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [statuses, chapters, work]);

  function handleToggleSave() {
    if (!session || !work) return;
    const nextSaved = !saved;
    setSaved(nextSaved);
    const seq = ++saveToggleSeqRef.current;
    const workSlug = work.slug;
    const workTitle = work.title;
    savePendingRef.current = savePendingRef.current
      .then(() => (nextSaved ? addToLibrary(session, workSlug, workTitle) : removeFromLibrary(session, workSlug)))
      .catch(() => {
        // Only roll back if this was the last toggle issued — an older failure
        // shouldn't clobber a newer, still-pending or already-applied state.
        if (seq === saveToggleSeqRef.current) setSaved(!nextSaved);
      });
  }

  function handleDownload(chapter: ProviderChapterSummary) {
    if (!session || !work) return;
    const key = downloadKey(work.slug, chapter.id);
    if (queueErrors[key]) removeItem(key);
    enqueue(session, work, chapter);
  }

  async function handleToggleRead(chapter: ProviderChapterSummary) {
    if (!session || !work) return;
    // Chapters the server already confirms as read (via reading history) can't be un-marked locally.
    if (readNumbers.has(chapter.number)) return;
    const prefix = buildProviderSourcePrefix(session, work.slug);
    const markKey = `${prefix}${chapter.id}`;
    const nextRead = !manualReadIds.has(chapter.id);
    setManualReadIds((prev) => {
      const next = new Set(prev);
      if (nextRead) next.add(chapter.id);
      else next.delete(chapter.id);
      return next;
    });
    if (nextRead) await markSourceRead(markKey);
    else await unmarkSourceRead(markKey);
  }

  function handleDownloadRead() {
    if (!session || !work) return;
    const pending = chapters.filter((chapter) => {
      if (!readNumbers.has(chapter.number)) return false;
      if (downloadedIds.has(chapter.id)) return false;
      const status = statuses[downloadKey(work.slug, chapter.id)];
      return status !== 'queued' && status !== 'downloading' && status !== 'done';
    });
    if (pending.length === 0) return;
    Alert.alert(
      'Baixar capítulos lidos?',
      `${pending.length} capítulo(s) que você já leu ainda não estão salvos no dispositivo. Deseja baixá-los agora para leitura offline?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Baixar',
          onPress: () => {
            for (const chapter of pending) enqueue(session, work, chapter);
          },
        },
      ]
    );
  }

  function handleDeleteDownload(chapter: ProviderChapterSummary) {
    if (!session || !work) return;
    Alert.alert(
      'Apagar capítulo baixado?',
      `Capítulo ${chapter.number} será removido do armazenamento do dispositivo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const prefix = buildProviderSourcePrefix(session, work.slug);
              const localChapter = await getChapterBySourceUri(`${prefix}${chapter.id}`);
              if (localChapter) await deleteDownloadedChapter(localChapter.id);
              setDownloadedIds((prev) => {
                const next = new Set(prev);
                next.delete(chapter.id);
                return next;
              });
            })();
          },
        },
      ]
    );
  }

  const visibleChapters = useMemo(() => {
    const trimmedQuery = chapterQuery.trim();
    let list = chapters;
    if (trimmedQuery) {
      list = list.filter((c) => String(c.number).includes(trimmedQuery));
    }
    list = [...list].sort((a, b) => (reversed ? a.number - b.number : b.number - a.number));
    return list;
  }, [chapters, chapterQuery, reversed]);

  // Resume point: prefer a chapter left mid-read; otherwise the next unread
  // chapter after the last one finished.
  const continueTarget = useMemo(() => {
    if (chapters.length === 0) return null;
    const byNumber = new Map(chapters.map((c) => [c.number, c]));
    const inProgress = [...history]
      .filter((h) => h.progressPercent > 0 && h.progressPercent < 90)
      .sort((a, b) => Number(b.chapterNumber) - Number(a.chapterNumber))[0];
    if (inProgress) {
      const chapter = byNumber.get(Number(inProgress.chapterNumber));
      if (chapter && !chapter.isLocked) return chapter;
    }
    if (readNumbers.size > 0) {
      const lastRead = Math.max(...readNumbers);
      const next = [...chapters]
        .sort((a, b) => a.number - b.number)
        .find((c) => c.number > lastRead && !c.isLocked);
      if (next) return next;
    }
    return null;
  }, [chapters, history, readNumbers]);

  const readToDownloadCount = chapters.filter(
    (c) => readNumbers.has(c.number) && !downloadedIds.has(c.id)
  ).length;

  if (!session) {
    return (
      <ScreenContainer topInset={false}>
        <EmptyState title="Conecte-se a um site" description="Volte para Ajustes e conecte sua conta em um site." />
      </ScreenContainer>
    );
  }

  if (loading) {
    return (
      <ScreenContainer topInset={false}>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      </ScreenContainer>
    );
  }

  if (error || !work) {
    return (
      <ScreenContainer topInset={false}>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <EmptyState title="Não foi possível abrir esta obra" description={error ?? undefined} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <FlatList
        data={visibleChapters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <View style={[styles.cover, { backgroundColor: colors.surfaceAlt }]}>
                {work.coverUrl ? (
                  <Image source={{ uri: work.coverUrl }} style={styles.coverImage} contentFit="cover" />
                ) : (
                  <Ionicons name="book-outline" size={32} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.headerInfo}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
                  {work.title}
                </Text>
                {work.type || work.tags?.length || work.publicationStatus ? (
                  <View style={styles.badgeRow}>
                    {work.type ? (
                      <View style={[styles.badge, { borderColor: colors.border }]}>
                        <Text style={[styles.badgeText, { color: colors.textMuted }]}>{work.type}</Text>
                      </View>
                    ) : null}
                    {work.publicationStatus ? (
                      <View style={[styles.badge, { borderColor: colors.border }]}>
                        <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                          {PUBLICATION_STATUS_LABELS[work.publicationStatus] ?? work.publicationStatus}
                        </Text>
                      </View>
                    ) : null}
                    {(work.tags ?? []).slice(0, 3).map((tag) => (
                      <View key={tag} style={[styles.badge, { borderColor: colors.border }]}>
                        <Text style={[styles.badgeText, { color: colors.textMuted }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {work.author ? (
                  <Text style={[styles.authorText, { color: colors.textMuted }]} numberOfLines={1}>
                    Autor: {work.author}
                  </Text>
                ) : null}
                <Pressable style={styles.favoriteRow} onPress={handleToggleSave}>
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={saved ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.favoriteText, { color: colors.textMuted }]}>
                    {saved ? 'Salvo para ler depois' : 'Salvar para ler depois'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {continueTarget ? (
              <Pressable
                style={[styles.continueButton, { backgroundColor: colors.accent }]}
                onPress={() =>
                  router.push({
                    pathname: '/provider-reader/[chapterId]',
                    params: { chapterId: continueTarget.id, slug: work.slug, title: work.title },
                  })
                }>
                <Ionicons name="play" size={16} color={colors.background} />
                <Text style={[styles.continueButtonText, { color: colors.background }]}>
                  Continuar capítulo {continueTarget.number}
                </Text>
              </Pressable>
            ) : null}

            {work.description ? (
              <View>
                <Text
                  style={[styles.description, { color: colors.textMuted }]}
                  numberOfLines={descriptionExpanded ? undefined : 4}>
                  {work.description}
                </Text>
                {work.description.length > DESCRIPTION_COLLAPSE_THRESHOLD ? (
                  <Pressable onPress={() => setDescriptionExpanded((v) => !v)}>
                    <Text style={[styles.readMore, { color: colors.accent }]}>
                      {descriptionExpanded ? 'Ler menos' : 'Ler mais'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.chapterToolbar}>
              <View style={[styles.chapterSearch, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="search" size={14} color={colors.textMuted} />
                <TextInput
                  value={chapterQuery}
                  onChangeText={setChapterQuery}
                  placeholder="Buscar por número"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  style={[styles.chapterSearchInput, { color: colors.text }]}
                />
              </View>
              {readToDownloadCount > 0 ? (
                <Pressable
                  hitSlop={8}
                  style={[styles.reverseButton, { borderColor: colors.border }]}
                  onPress={handleDownloadRead}>
                  <Ionicons name="checkmark-done-outline" size={16} color={colors.text} />
                </Pressable>
              ) : null}
              <Pressable
                hitSlop={8}
                style={[styles.reverseButton, { borderColor: colors.border }]}
                onPress={() => setReversed((v) => !v)}>
                <Ionicons name={reversed ? 'arrow-up' : 'arrow-down'} size={16} color={colors.text} />
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              {chapters.length} {chapters.length === 1 ? 'capítulo' : 'capítulos'}
            </Text>
          </>
        }
        ListEmptyComponent={
          <EmptyState title="Nenhum capítulo encontrado" description="Tente buscar por outro número." />
        }
        renderItem={({ item }) => {
          const key = downloadKey(work.slug, item.id);
          const status = statuses[key];
          const queueError = queueErrors[key];
          const isRead = readNumbers.has(item.number) || manualReadIds.has(item.id);
          return (
            <Pressable
              style={[styles.chapterRow, { borderColor: colors.border }]}
              disabled={item.isLocked}
              onPress={() =>
                router.push({
                  pathname: '/provider-reader/[chapterId]',
                  params: { chapterId: item.id, slug: work.slug, title: work.title },
                })
              }>
              <View style={styles.chapterInfo}>
                <Text style={[styles.chapterTitle, { color: colors.text }]} numberOfLines={1}>
                  Capítulo {item.number}{item.title ? ` — ${item.title}` : ''}
                </Text>
                {item.publishedAt || isRead ? (
                  <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                    {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('pt-BR') : ''}
                    {item.publishedAt && isRead ? ' · ' : ''}
                    {isRead ? 'Lido' : ''}
                  </Text>
                ) : null}
              </View>
              {item.isLocked ? null : (
                <Pressable hitSlop={8} onPress={() => void handleToggleRead(item)}>
                  <Ionicons
                    name={isRead ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={20}
                    color={isRead ? colors.accent : colors.textMuted}
                  />
                </Pressable>
              )}
              {item.isLocked ? (
                <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
              ) : queueError ? (
                <Pressable style={styles.chapterStatusWrap} hitSlop={10} onPress={() => handleDownload(item)}>
                  <Ionicons name="alert-circle" size={20} color={colors.danger} />
                </Pressable>
              ) : status === 'queued' ? (
                <View style={styles.chapterStatusWrap}>
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                </View>
              ) : status === 'downloading' ? (
                <View style={styles.chapterStatusWrap}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              ) : downloadedIds.has(item.id) ? (
                <Pressable style={styles.chapterStatusWrap} hitSlop={10} onPress={() => handleDeleteDownload(item)}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                </Pressable>
              ) : (
                <Pressable style={styles.chapterStatusWrap} hitSlop={10} onPress={() => handleDownload(item)}>
                  <Ionicons name="cloud-download-outline" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              {item.isLocked ? null : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 32,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  cover: {
    width: 96,
    height: 136,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
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
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  continueButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  authorText: {
    fontSize: 12,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  readMore: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  chapterToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  chapterSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chapterSearchInput: {
    flex: 1,
    fontSize: 13,
  },
  reverseButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  chapterStatusWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
