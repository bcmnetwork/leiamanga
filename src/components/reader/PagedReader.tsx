import { useCallback, useRef } from 'react';
import { Dimensions, FlatList, StyleSheet, View, ViewToken } from 'react-native';

import type { ReadingDirection } from '@/src/state/readerSettingsStore';
import { ZoomablePage } from './ZoomablePage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PagedReaderProps {
  pageUris: string[];
  direction: ReadingDirection;
  initialPage: number;
  onPageChange: (index: number) => void;
  onToggleOverlay: () => void;
}

export function PagedReader({
  pageUris,
  direction,
  initialPage,
  onPageChange,
  onToggleOverlay,
}: PagedReaderProps) {
  const listRef = useRef<FlatList<string>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (!first || typeof first.index !== 'number') return;
      onPageChange(first.index);
    },
    [onPageChange]
  );

  return (
    <FlatList
      ref={listRef}
      data={pageUris}
      keyExtractor={(uri, index) => `p-${index}-${uri}`}
      horizontal
      pagingEnabled
      inverted={direction === 'rtl'}
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={initialPage > 0 ? initialPage : undefined}
      getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      renderItem={({ item }) => (
        <View style={styles.page}>
          <ZoomablePage uri={item} onTap={onToggleOverlay} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    width: SCREEN_WIDTH,
  },
});
