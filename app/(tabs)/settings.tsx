import { Ionicons } from '@expo/vector-icons';
import { Directory, Paths } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { deleteAllDownloads } from '@/src/db/libraryMaintenance';
import { useContentProviderStore } from '@/src/state/contentProviderStore';
import {
    ReadingDirection,
    ReadingMode,
    useReaderSettingsStore,
} from '@/src/state/readerSettingsStore';
import { useAppTheme } from '@/src/theme';

const MODE_OPTIONS: { key: ReadingMode; label: string }[] = [
  { key: 'single', label: 'Página única' },
  { key: 'vertical', label: 'Vertical (webtoon)' },
];

const DIRECTION_OPTIONS: { key: ReadingDirection; label: string }[] = [
  { key: 'ltr', label: 'Esquerda → Direita' },
  { key: 'rtl', label: 'Direita → Esquerda' },
];

function getStorageUsageBytes(): number {
  const chaptersSize = new Directory(Paths.document, 'chapters').size ?? 0;
  const seriesSize = new Directory(Paths.document, 'series').size ?? 0;
  return chaptersSize + seriesSize;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { session, disconnecting, disconnect } = useContentProviderStore();
  const {
    mode,
    direction,
    keepAwake,
    hydrate,
    setMode,
    setDirection,
    setKeepAwake,
  } = useReaderSettingsStore();
  const [storageBytes, setStorageBytes] = useState(0);
  const [clearing, setClearing] = useState(false);

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

  function handleDisconnect() {
    Alert.alert('Desconectar site?', 'Você precisará entrar novamente para ler ou baixar capítulos deste site.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: () => void disconnect() },
    ]);
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Ajustes</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Leitura</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {MODE_OPTIONS.map((option, index) => (
            <Pressable
              key={option.key}
              style={[
                styles.cardRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
              onPress={() => setMode(option.key)}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
              {mode === option.key ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
              )}
            </Pressable>
          ))}
        </View>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {DIRECTION_OPTIONS.map((option, index) => (
            <Pressable
              key={option.key}
              style={[
                styles.cardRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
              onPress={() => setDirection(option.key)}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
              {direction === option.key ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
              )}
            </Pressable>
          ))}
        </View>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Manter tela ligada ao ler</Text>
            <Switch value={keepAwake} onValueChange={setKeepAwake} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Armazenamento</Text>
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

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Site conectado</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {session ? (
            <View style={styles.cardRow}>
              <View style={styles.optionTextGroup}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{session.domain}</Text>
                <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>Conectado</Text>
              </View>
              <Pressable hitSlop={8} disabled={disconnecting} onPress={handleDisconnect}>
                {disconnecting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={[styles.disconnectText, { color: colors.danger }]}>Desconectar</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.cardRow} onPress={() => router.push('/providers')}>
              <View style={styles.optionTextGroup}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>Nenhum site conectado</Text>
                <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>
                  Conectar a um site para ler e baixar capítulos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <View style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="book" size={28} color={colors.accent} />
          <View style={styles.bannerTextGroup}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>App LeiaManga</Text>
            <Text style={[styles.bannerSubtitle, { color: colors.textMuted }]}>
              Seu leitor pessoal de mangás — biblioteca local e sites conectados em um só lugar.
            </Text>
          </View>
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>Leia Manga · versão 0.1.0</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
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
  disconnectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
  },
  bannerTextGroup: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  bannerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 32,
    marginBottom: 16,
  },
});
