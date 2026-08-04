import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, type ReactElement } from 'react';
import { Dimensions, FlatList } from 'react-native';

import { ZoomableVerticalPage } from './ZoomableVerticalPage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_ASPECT_RATIO = 0.7;

export interface VerticalReaderHandle {
  scrollToTop: () => void;
}

interface VerticalReaderProps {
  pageUris: string[];
  initialPage: number;
  /** Extra space reserved at the top so the overlay header doesn't cover the first page. */
  topInset?: number;
  onPageChange: (index: number) => void;
  onToggleOverlay: () => void;
  /** Fires once the user scrolls near the bottom of the chapter — more reliable than
   * watching the last item's viewability, which can flicker in/out on tall pages. */
  onEndReached?: () => void;
  /** Rendered after the last page as normal scroll content, so it never overlaps the image. */
  footer?: ReactElement | null;
}

export const VerticalReader = forwardRef<VerticalReaderHandle, VerticalReaderProps>(function VerticalReader(
  { pageUris, initialPage, topInset = 0, onPageChange, onToggleOverlay, onEndReached, footer },
  ref
) {
  const listRef = useRef<FlatList<string>>(null);
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  const [zoomed, setZoomed] = useState(false);

  useImperativeHandle(ref, () => ({
    scrollToTop: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  }));

  // Each page can have a different aspect ratio, so the layout must use real cumulative
  // offsets instead of assuming a uniform height per index (that mismatch was causing the
  // page counter to drift once a page's actual size differed from the running estimate).
  const heights = useMemo(
    () => pageUris.map((uri) => SCREEN_WIDTH / (aspectRatios[uri] ?? DEFAULT_ASPECT_RATIO)),
    [pageUris, aspectRatios]
  );

  const offsets = useMemo(() => {
    const result: number[] = [];
    let acc = topInset;
    for (const height of heights) {
      result.push(acc);
      acc += height;
    }
    return result;
  }, [heights, topInset]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const first = viewableItems[0];
      if (!first || first.index === null) return;
      onPageChange(first.index);
    },
    [onPageChange]
  );

  return (
    <FlatList
      ref={listRef}
      data={pageUris}
      keyExtractor={(uri) => uri}
      scrollEnabled={!zoomed}
      initialScrollIndex={initialPage > 0 ? initialPage : undefined}
      contentContainerStyle={{ paddingTop: topInset }}
      getItemLayout={(_, index) => ({ length: heights[index], offset: offsets[index], index })}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.1}
      ListFooterComponent={footer}
      renderItem={({ item: uri, index }) => (
        <ZoomableVerticalPage
          uri={uri}
          width={SCREEN_WIDTH}
          height={heights[index]}
          onTap={onToggleOverlay}
          onZoomChange={setZoomed}
          onLoad={(width, height) => {
            setAspectRatios((prev) => (prev[uri] ? prev : { ...prev, [uri]: width / height }));
          }}
        />
      )}
    />
  );
});
