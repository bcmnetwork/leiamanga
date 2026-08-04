import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { useDownloadQueueStore } from '@/src/state/downloadQueueStore';
import { useAppTheme } from '@/src/theme';

export default function DownloadsScreen() {
  const { colors } = useAppTheme();
  const { statuses, errors, progress, meta, retry, removeItem, clearFinished, waitingForWifi } =
    useDownloadQueueStore();

  const keys = Object.keys(meta);
  const hasFinished = keys.some((key) => statuses[key] === 'done');

  function handleLongPressRemove(key: string, title: string) {
    Alert.alert('Remover download?', `"${title}" será removido da lista de downloads.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeItem(key) },
    ]);
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Downloads',
          headerRight: () =>
            hasFinished ? (
              <Pressable hitSlop={8} onPress={clearFinished} accessibilityLabel="Limpar concluídos">
                <Ionicons name="trash-outline" size={20} color={colors.accent} />
              </Pressable>
            ) : null,
        }}
      />
      {waitingForWifi ? (
        <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Ionicons name="wifi-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.bannerText, { color: colors.textMuted }]}>
            Aguardando Wi-Fi para continuar os downloads.
          </Text>
        </View>
      ) : null}
      <FlatList
        data={keys}
        keyExtractor={(key) => key}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title="Nenhum download"
            description="Os capítulos que você baixar de um site conectado aparecerão aqui com o progresso do download."
          />
        }
        renderItem={({ item: key }) => {
          const item = meta[key];
          const status = statuses[key];
          const error = errors[key];
          const prog = progress[key];
          const percent = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;

          return (
            <Pressable
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onLongPress={() => handleLongPressRemove(key, item.workTitle)}
              delayLongPress={400}>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.workTitle}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  Capítulo {item.chapterNumber}
                  {item.chapterTitle ? ` — ${item.chapterTitle}` : ''}
                </Text>
                {status === 'downloading' && prog && prog.total > 0 ? (
                  <View style={styles.progressRow}>
                    <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { backgroundColor: colors.accent, width: `${percent}%` },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, { color: colors.textMuted }]}>
                      {prog.done}/{prog.total}
                    </Text>
                  </View>
                ) : null}
                {error ? (
                  <Text style={[styles.errorText, { color: colors.danger }]} numberOfLines={2}>
                    {error}
                  </Text>
                ) : null}
              </View>

              {status === 'queued' ? (
                <View style={styles.statusWrap}>
                  <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.statusText, { color: colors.textMuted }]}>Na fila</Text>
                </View>
              ) : status === 'downloading' ? (
                <View style={styles.statusWrap}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.statusText, { color: colors.textMuted }]}>Baixando</Text>
                </View>
              ) : status === 'done' ? (
                <Pressable style={styles.statusWrap} hitSlop={8} onPress={() => removeItem(key)}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                </Pressable>
              ) : status === 'error' ? (
                <View style={styles.errorActions}>
                  <Pressable style={styles.statusWrap} hitSlop={8} onPress={() => retry(key)}>
                    <Ionicons name="refresh" size={20} color={colors.accent} />
                    <Text style={[styles.statusText, { color: colors.accent }]}>Tentar de novo</Text>
                  </Pressable>
                  <Pressable style={styles.statusWrap} hitSlop={8} onPress={() => removeItem(key)}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                    <Text style={[styles.statusText, { color: colors.danger }]}>Remover</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: {
    fontSize: 12,
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 14,
  },
  statusWrap: {
    alignItems: 'center',
    gap: 2,
    minWidth: 56,
  },
  statusText: {
    fontSize: 10,
  },
});
