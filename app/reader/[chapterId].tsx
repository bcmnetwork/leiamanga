import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/src/components/common/EmptyState';
import { PagedReader } from '@/src/components/reader/PagedReader';
import { ReaderQuickSettingsButton } from '@/src/components/reader/ReaderQuickSettingsButton';
import { VerticalReader, type VerticalReaderHandle } from '@/src/components/reader/VerticalReader';
import {
    getAdjacentChapter,
    getProgress,
    getSeriesById,
    saveProgress,
    toggleFavorite,
} from '@/src/db/repository';
import type { ChapterRow } from '@/src/db/types';
import { useChapterPages } from '@/src/reader/useChapterPages';
import { useReaderSettingsStore } from '@/src/state/readerSettingsStore';
import { useAppTheme } from '@/src/theme';

const KEEP_AWAKE_TAG = 'leia-manga-reader';
const TOP_OVERLAY_HEIGHT = 88;

export default function ReaderScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  // Keyed by chapterId so navigating to the next/previous chapter (router.replace on the
  // same route) fully remounts the reader instead of reusing stale page/progress state.
  return <ReaderScreenContent key={chapterId} chapterId={chapterId} />;
}

function ReaderScreenContent({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { loading, error, chapter, pageUris } = useChapterPages(chapterId);
  const { mode, direction, brightnessOverlay, keepAwake, orientationLock, setMode, setDirection, hydrate } =
    useReaderSettingsStore();
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [initialPage, setInitialPage] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [nextChapter, setNextChapter] = useState<ChapterRow | null>(null);
  const initializedRef = useRef(false);
  const verticalReaderRef = useRef<VerticalReaderHandle>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!chapter?.series_id) return;
    let cancelled = false;
    (async () => {
      const series = await getSeriesById(chapter.series_id);
      if (!cancelled && series) setFavorite(Boolean(series.favorite));
    })();
    return () => {
      cancelled = true;
    };
  }, [chapter?.series_id]);

  useEffect(() => {
    if (!chapter) {
      setNextChapter(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const next = await getAdjacentChapter(chapter.series_id, chapter.sort_order, 'next');
      if (!cancelled) setNextChapter(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [chapter]);

  async function handleToggleFavorite() {
    if (!chapter?.series_id) return;
    setFavorite((v) => !v);
    await toggleFavorite(chapter.series_id);
  }

  function handleGoToNextChapter() {
    if (!nextChapter) return;
    router.replace(`/reader/${nextChapter.id}`);
  }

  useEffect(() => {
    if (!chapterId || initializedRef.current) return;
    initializedRef.current = true;
    (async () => {
      const savedPage = await getProgress(chapterId);
      setInitialPage(savedPage);
      setCurrentPage(savedPage);
    })();
  }, [chapterId]);

  useEffect(() => {
    if (!chapterId) return;
    void saveProgress(chapterId, currentPage);
  }, [chapterId, currentPage]);

  useEffect(() => {
    if (!keepAwake) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [keepAwake]);

  useEffect(() => {
    const lock =
      orientationLock === 'landscape'
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : orientationLock === 'auto'
          ? ScreenOrientation.OrientationLock.ALL
          : ScreenOrientation.OrientationLock.PORTRAIT_UP;
    void ScreenOrientation.lockAsync(lock);
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [orientationLock]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || pageUris.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: true, title: 'Leitor' }} />
        <EmptyState title="Não foi possível abrir o capítulo" description={error ?? undefined} />
      </View>
    );
  }

  const endOfChapterContent = (
    <>
      <Text style={styles.endOfChapterText}>Fim do capítulo</Text>
      <View style={styles.endOfChapterActions}>
        <Pressable style={styles.endOfChapterButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.endOfChapterButtonText}>Voltar</Text>
        </Pressable>
        {nextChapter ? (
          <Pressable style={styles.endOfChapterButton} onPress={handleGoToNextChapter}>
            <Text style={styles.endOfChapterButtonText}>Próximo capítulo</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {mode === 'vertical' ? (
        <VerticalReader
          ref={verticalReaderRef}
          pageUris={pageUris}
          initialPage={initialPage}
          topInset={TOP_OVERLAY_HEIGHT}
          onPageChange={setCurrentPage}
          onToggleOverlay={() => setOverlayVisible((v) => !v)}
          onEndReached={() => setReachedEnd(true)}
          footer={
            <View
              style={[
                styles.endOfChapterInline,
                { backgroundColor: colors.background, paddingBottom: 28 + insets.bottom },
              ]}>
              {endOfChapterContent}
            </View>
          }
        />
      ) : (
        <PagedReader
          pageUris={pageUris}
          direction={direction}
          initialPage={initialPage}
          onPageChange={setCurrentPage}
          onToggleOverlay={() => setOverlayVisible((v) => !v)}
        />
      )}

      {brightnessOverlay > 0 ? (
        <View pointerEvents="none" style={[styles.dimOverlay, { opacity: brightnessOverlay }]} />
      ) : null}

      {overlayVisible ? (
        <View style={[styles.topOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.topOverlayInfo}>
            <Text style={styles.topOverlayTitle} numberOfLines={1}>
              {chapter?.title}
            </Text>
            <Text style={styles.topOverlaySubtitle}>
              Página {currentPage + 1} de {pageUris.length}
            </Text>
          </View>
          {chapter?.series_id ? (
            <Pressable hitSlop={8} onPress={() => void handleToggleFavorite()}>
              <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color="#fff" />
            </Pressable>
          ) : null}
          <ReaderQuickSettingsButton
            mode={mode}
            direction={direction}
            onChangeMode={setMode}
            onChangeDirection={setDirection}
          />
        </View>
      ) : null}

      {mode === 'vertical' && overlayVisible && currentPage < pageUris.length - 1 && !reachedEnd ? (
        <Pressable
          style={[styles.scrollToTopButton, { backgroundColor: colors.overlay, bottom: 32 + insets.bottom }]}
          onPress={() => verticalReaderRef.current?.scrollToTop()}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      ) : null}

      {mode !== 'vertical' && currentPage === pageUris.length - 1 ? (
        <View style={[styles.endOfChapter, { backgroundColor: colors.overlay, paddingBottom: 28 + insets.bottom }]}>
          {endOfChapterContent}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  topOverlayInfo: {
    flex: 1,
  },
  topOverlayTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  topOverlaySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  endOfChapter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 12,
  },
  endOfChapterInline: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 12,
  },
  endOfChapterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  endOfChapterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  endOfChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  endOfChapterButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollToTopButton: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
