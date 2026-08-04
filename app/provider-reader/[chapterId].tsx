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
import { useProviderChapterPages } from '@/src/reader/useProviderChapterPages';
import {
    addToLibrary,
    getChapters,
    getLibrary,
    removeFromLibrary,
    type ProviderChapterSummary,
} from '@/src/services/contentProvider/ContentCatalogService';
import { useContentProviderStore } from '@/src/state/contentProviderStore';
import { useReaderSettingsStore } from '@/src/state/readerSettingsStore';
import { useAppTheme } from '@/src/theme';

const KEEP_AWAKE_TAG = 'leia-manga-provider-reader';
const TOP_OVERLAY_HEIGHT = 88;

export default function ProviderReaderScreen() {
  const { chapterId, slug, title } = useLocalSearchParams<{ chapterId: string; slug: string; title?: string }>();
  // Keyed by chapterId so navigating to the next chapter (router.replace on the same route)
  // fully remounts the reader instead of reusing stale page/progress state.
  return <ProviderReaderScreenContent key={chapterId} chapterId={chapterId} slug={slug} title={title} />;
}

interface ProviderReaderScreenContentProps {
  chapterId: string;
  slug: string;
  title?: string;
}

function ProviderReaderScreenContent({ chapterId, slug, title }: ProviderReaderScreenContentProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { session } = useContentProviderStore();
  const { loading, error, pages } = useProviderChapterPages(session, slug, chapterId);
  const pageUris = pages.map((page) => page.imageUrl);
  const { mode, direction, brightnessOverlay, keepAwake, orientationLock, setMode, setDirection, hydrate } =
    useReaderSettingsStore();
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [nextChapter, setNextChapter] = useState<ProviderChapterSummary | null>(null);
  const verticalReaderRef = useRef<VerticalReaderHandle>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!session || !slug) return;
    let cancelled = false;
    (async () => {
      const library = await getLibrary(session).catch(() => []);
      if (!cancelled) setSaved(library.some((item) => item.workSlug === slug));
    })();
    return () => {
      cancelled = true;
    };
  }, [session, slug]);

  useEffect(() => {
    if (!session || !slug || !chapterId) {
      setNextChapter(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const list = await getChapters(session, slug).catch(() => []);
      const sorted = [...list].sort((a, b) => a.number - b.number);
      const index = sorted.findIndex((c) => c.id === chapterId);
      const next = index >= 0 ? (sorted[index + 1] ?? null) : null;
      if (!cancelled) setNextChapter(next && !next.isLocked ? next : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, slug, chapterId]);

  async function handleToggleSave() {
    if (!session || !slug || savingToggle) return;
    setSavingToggle(true);
    try {
      if (saved) {
        await removeFromLibrary(session, slug);
        setSaved(false);
      } else {
        await addToLibrary(session, slug, title ?? slug);
        setSaved(true);
      }
    } catch {
      // Non-critical — user can retry from the work screen.
    } finally {
      setSavingToggle(false);
    }
  }

  function handleGoToNextChapter() {
    if (!nextChapter || !slug) return;
    router.replace({
      pathname: '/provider-reader/[chapterId]',
      params: { chapterId: nextChapter.id, slug, title },
    });
  }

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
          initialPage={0}
          topInset={TOP_OVERLAY_HEIGHT}
          onPageChange={setCurrentPage}
          onToggleOverlay={() => setOverlayVisible((v) => !v)}
          onEndReached={() => setReachedEnd(true)}
          footer={
            <View
              style={[
                styles.endOfChapterInline,
                { backgroundColor: colors.overlay, paddingBottom: 28 + insets.bottom },
              ]}>
              {endOfChapterContent}
            </View>
          }
        />
      ) : (
        <PagedReader
          pageUris={pageUris}
          direction={direction}
          initialPage={0}
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
            <Text style={styles.topOverlaySubtitle}>
              Página {currentPage + 1} de {pageUris.length}
            </Text>
          </View>
          <Pressable hitSlop={8} disabled={savingToggle} onPress={() => void handleToggleSave()}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color="#fff" />
          </Pressable>
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
