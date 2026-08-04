import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/src/theme';

interface ScreenContainerProps extends PropsWithChildren {
  /** Set to false when the screen already has a native Stack header
   * (`headerShown: true`) — that header already accounts for the top safe
   * area, so adding this container's own top inset on top of it double-pads
   * the screen. Defaults to true (no native header). */
  topInset?: boolean;
}

export function ScreenContainer({ children, topInset = true }: ScreenContainerProps) {
  const { colors } = useAppTheme();
  const edges: Edge[] = topInset ? ['top'] : [];
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={edges}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
