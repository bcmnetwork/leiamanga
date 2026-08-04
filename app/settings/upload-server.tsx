import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { useUploadServerStore } from '@/src/state/uploadServerStore';
import { useAppTheme } from '@/src/theme';

export default function UploadServerSettingsScreen() {
  const { colors } = useAppTheme();
  const { running, starting, ip, port, password, log, error, start, stop } = useUploadServerStore();

  useEffect(() => {
    return () => {
      // Stop the server when leaving the screen so it doesn't keep listening in the background.
      if (useUploadServerStore.getState().running) stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggle(value: boolean) {
    if (!value) {
      stop();
      return;
    }
    Alert.alert(
      'Rede Wi-Fi pública ou compartilhada?',
      'Qualquer aparelho na mesma rede Wi-Fi poderá ver o endereço do servidor enquanto ele estiver ligado. Use apenas em redes de confiança (ex: sua casa) e mantenha o PIN gerado em segredo — ele é exigido para enviar arquivos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ligar mesmo assim', onPress: () => void start() },
      ]
    );
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Enviar pela rede local' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textMuted }]}>
          Ligue o servidor e acesse o endereço abaixo no navegador de um computador conectado à mesma
          rede Wi-Fi para enviar arquivos .cbz direto para a sua biblioteca.
        </Text>

        <View style={[styles.card, { borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <View style={styles.optionTextGroup}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Servidor de envio</Text>
              <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>
                {running ? 'Ativo — pronto para receber arquivos' : 'Desligado'}
              </Text>
            </View>
            {starting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Switch value={running} onValueChange={handleToggle} />
            )}
          </View>

          {running && ip ? (
            <View style={[styles.urlBox, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Ionicons name="wifi-outline" size={18} color={colors.accent} />
              <Text selectable style={[styles.urlText, { color: colors.accent }]}>
                http://{ip}:{port}
              </Text>
            </View>
          ) : null}

          {running && password ? (
            <View style={[styles.urlBox, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Ionicons name="key-outline" size={18} color={colors.text} />
              <View style={styles.optionTextGroup}>
                <Text selectable style={[styles.urlText, { color: colors.text }]}>
                  PIN: {password}
                </Text>
                <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>
                  Informe este PIN na página aberta no computador. Ele muda toda vez que o servidor é ligado.
                </Text>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.urlBox, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.urlText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Arquivos recebidos</Text>
        <View style={[styles.card, { borderColor: colors.border }]}>
          {log.length === 0 ? (
            <View style={styles.cardRow}>
              <Text style={[styles.optionSubLabel, { color: colors.textMuted }]}>Nenhum arquivo recebido ainda.</Text>
            </View>
          ) : (
            log.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                style={[
                  styles.cardRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}>
                <View style={styles.optionTextGroup}>
                  <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.message ? (
                    <Text style={[styles.optionSubLabel, { color: colors.danger }]}>{item.message}</Text>
                  ) : null}
                </View>
                <Ionicons
                  name={item.ok ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={item.ok ? colors.accent : colors.danger}
                />
              </View>
            ))
          )}
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
  description: {
    fontSize: 13,
    marginHorizontal: 16,
    lineHeight: 19,
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
    marginTop: 16,
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
    gap: 10,
  },
  optionTextGroup: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionSubLabel: {
    fontSize: 12,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  urlText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
