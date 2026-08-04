import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { useAppTheme } from '@/src/theme';

export default function NewsScreen() {
  const { colors } = useAppTheme();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notícias</Text>
      </View>
      <EmptyState
        title="Em breve"
        description="Novidades e avisos sobre o app e os sites conectados vão aparecer aqui."
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
});
