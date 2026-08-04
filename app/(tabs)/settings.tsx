import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { useContentProviderStore } from '@/src/state/contentProviderStore';
import { useAppTheme } from '@/src/theme';

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { session, disconnecting, disconnect } = useContentProviderStore();

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

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Preferências</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Pressable style={styles.cardRow} onPress={() => router.push('/settings/reading')}>
            <View style={styles.rowIconGroup}>
              <Ionicons name="book-outline" size={20} color={colors.text} />
              <Text style={[styles.optionLabel, { color: colors.text }]}>Leitura</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.cardRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            onPress={() => router.push('/settings/storage')}>
            <View style={styles.rowIconGroup}>
              <Ionicons name="server-outline" size={20} color={colors.text} />
              <Text style={[styles.optionLabel, { color: colors.text }]}>Armazenamento</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.cardRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            onPress={() => router.push('/settings/appearance')}>
            <View style={styles.rowIconGroup}>
              <Ionicons name="color-palette-outline" size={20} color={colors.text} />
              <Text style={[styles.optionLabel, { color: colors.text }]}>Aparência</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.cardRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            onPress={() => router.push('/settings/trackers')}>
            <View style={styles.rowIconGroup}>
              <Ionicons name="list-outline" size={20} color={colors.text} />
              <Text style={[styles.optionLabel, { color: colors.text }]}>Rastreadores</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
              Seu leitor pessoal de mangás — sua biblioteca sempre com você.
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.siteLink}
          onPress={() => void WebBrowser.openBrowserAsync('https://leiamanga.com')}>
          <Text style={[styles.footer, { color: colors.textMuted }]}>Leia Manga · versão 0.1.0</Text>
          <Text style={[styles.siteLinkText, { color: colors.accent }]}>leiamanga.com</Text>
        </Pressable>
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
  rowIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
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
  },
  siteLink: {
    alignItems: 'center',
    marginBottom: 16,
  },
  siteLinkText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
