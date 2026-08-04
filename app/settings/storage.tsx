import { Ionicons } from '@expo/vector-icons';
import { Directory, Paths } from 'expo-file-system';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { deleteAllDownloads } from '@/src/db/libraryMaintenance';
import { useDownloadQueueStore } from '@/src/state/downloadQueueStore';
import { useDownloadSettingsStore } from '@/src/state/downloadSettingsStore';
import { useAppTheme } from '@/src/theme';

function getStorageUsageBytes(): number {
  const chaptersSize = new Directory(Paths.document, 'chapters').size ?? 0;
  const seriesSize = new Directory(Paths.document, 'series').size ?? 0;
  return chaptersSize + seriesSize;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default function StorageSettingsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [storageBytes, setStorageBytes] = useState(0);
  const [clearing, setClearing] = useState(false);
  const { wifiOnly, hydrate, setWifiOnly } = useDownloadSettingsStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      setStorageBytes(getStorageUsageBytes());
    }, [])
  );

  function handleClearDownloads() {
    Alert.alert(
      'Apagar todos os downloads?',
      'Todos os capítulos baixados (importados e obtidos de sites conectados) serão removidos do dispositivo. Isso não afeta sua conta no site.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearing(true);
              try {
                await deleteAllDownloads();
                setStorageBytes(getStorageUsageBytes());
              } finally {
                setClearing(false);
              }
            })();
          },
        },
      ]
    );
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Armazenamento' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Espaço em disco</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Espaço usado por capítulos baixados</Text>
            <Text style={[styles.optionValue, { color: colors.textMuted }]}>{formatMB(storageBytes)} MB</Text>
          </View>
          <Pressable
            style={[styles.cardRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            disabled={clearing}
            onPress={handleClearDownloads}>
            <Text style={[styles.optionLabel, { color: colors.danger }]}>Apagar todos os downloads</Text>
            {clearing ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            )}
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Downloads</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <View style={styles.optionTextGroup}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Baixar apenas com Wi-Fi</Text>
              <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>
                Novos downloads aguardam uma rede Wi-Fi em vez de usar dados móveis
              </Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={(value) => {
                setWifiOnly(value);
                if (!value) useDownloadQueueStore.getState().resumeQueue();
              }}
            />
          </View>
          <Pressable
            style={[styles.cardRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            onPress={() => router.push('/downloads')}>
            <View style={styles.optionTextGroup}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Gerenciador de downloads</Text>
              <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>
                Acompanhe o progresso dos downloads em andamento
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.cardRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            onPress={() => router.push('/settings/upload-server')}>
            <View style={styles.optionTextGroup}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Enviar pela rede local</Text>
              <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>
                Envie arquivos .cbz do computador para o celular pelo Wi-Fi
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextGroup: {
    flex: 1,
    gap: 2,
  },
  optionSubLabel: {
    fontSize: 12,
  },
});
