import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SeriesWithProgress } from '@/src/db/types';
import { useAppTheme } from '@/src/theme';

interface SeriesGridItemProps {
  series: SeriesWithProgress;
  onPress: () => void;
  onLongPress: () => void;
  onToggleFavorite: () => void;
}

export function SeriesGridItem({ series, onPress, onLongPress, onToggleFavorite }: SeriesGridItemProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
      onPress={onPress}
      onLongPress={onLongPress}>
      <View style={[styles.coverWrapper, { backgroundColor: colors.surfaceAlt }]}>
        {series.cover_path ? (
          <Image source={{ uri: series.cover_path }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="book-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        <Pressable
          style={[styles.favoriteBadge, { backgroundColor: colors.overlay }]}
          onPress={onToggleFavorite}
          hitSlop={8}>
          <Ionicons
            name={series.favorite ? 'star' : 'star-outline'}
            size={16}
            color={series.favorite ? '#FFD166' : '#FFFFFF'}
          />
        </Pressable>
      </View>
      <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
        {series.title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {series.chapterCount} {series.chapterCount === 1 ? 'capítulo' : 'capítulos'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: 20,
  },
  containerPressed: {
    opacity: 0.6,
  },
  coverWrapper: {
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 12,
    padding: 4,
  },
  title: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
  },
});
