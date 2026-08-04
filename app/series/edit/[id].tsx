import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { getSeriesById, listChaptersForSeries, updateSeriesMetadata } from '@/src/db/repository';
import type { SeriesRow } from '@/src/db/types';
import { getWork } from '@/src/services/contentProvider/ContentCatalogService';
import { useContentProviderStore } from '@/src/state/contentProviderStore';
import { useAppTheme } from '@/src/theme';
import { genreLabelFromSlug } from '@/src/utils/genre';

async function pickAndCopyCover(seriesId: string): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const extMatch = /\.([a-z0-9]{2,4})$/i.exec(asset.name ?? '');
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

  const coverDir = new Directory(Paths.document, 'series', seriesId);
  coverDir.create({ intermediates: true, idempotent: true });
  const destFile = new File(coverDir, `cover.${ext}`);
  if (destFile.exists) destFile.delete();
  new File(asset.uri).copy(destFile);
  return destFile.uri;
}

async function downloadCover(seriesId: string, coverUrl: string): Promise<string> {
  const ext = /\.([a-z0-9]{2,4})(?:\?|$)/i.exec(coverUrl)?.[1]?.toLowerCase() ?? 'jpg';
  const coverDir = new Directory(Paths.document, 'series', seriesId);
  coverDir.create({ intermediates: true, idempotent: true });
  const destFile = new File(coverDir, `cover.${ext}`);
  if (destFile.exists) destFile.delete();
  await File.downloadFileAsync(coverUrl, destFile, { idempotent: true });
  return destFile.uri;
}

export default function SeriesEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useContentProviderStore();

  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [author, setAuthor] = useState('');
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [pickingCover, setPickingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providerWorkSlug, setProviderWorkSlug] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [row, chapters] = await Promise.all([getSeriesById(id), listChaptersForSeries(id)]);
    setSeries(row);
    if (row) {
      setTitle(row.title);
      setDescription(row.description ?? '');
      setGenre(row.genre ?? '');
      setAuthor(row.author ?? '');
      setCoverPath(row.cover_path);
    }
    // Only offer syncing when this series has a chapter downloaded from the
    // CURRENTLY connected site — that's the only work we can safely re-fetch.
    if (session) {
      const prefix = `provider:${session.domain}:`;
      const linked = chapters.find((c) => c.source_uri.startsWith(prefix));
      setProviderWorkSlug(linked ? linked.source_uri.slice(prefix.length).split(':')[0] : null);
    } else {
      setProviderWorkSlug(null);
    }
    setLoading(false);
  }, [id, session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSyncWithProvider() {
    if (!session || !providerWorkSlug || !series) return;
    setSyncing(true);
    try {
      const work = await getWork(session, providerWorkSlug);
      setTitle(work.title);
      setDescription(work.description ?? '');
      if (work.tags?.length) setGenre(work.tags.map(genreLabelFromSlug).join(', '));
      if (work.author) setAuthor(work.author);
      if (work.coverUrl) {
        const newCoverPath = await downloadCover(series.id, work.coverUrl);
        setCoverPath(newCoverPath);
      }
      Alert.alert('Dados atualizados', 'Revise as informações e toque em Salvar para confirmar.');
    } catch {
      Alert.alert('Erro', 'Não foi possível sincronizar com o provedor.');
    } finally {
      setSyncing(false);
    }
  }

  async function handlePickCover() {
    if (!series) return;
    setPickingCover(true);
    try {
      const newCoverPath = await pickAndCopyCover(series.id);
      if (newCoverPath) setCoverPath(newCoverPath);
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar a imagem de capa.');
    } finally {
      setPickingCover(false);
    }
  }

  async function handleSave() {
    if (!series) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Título obrigatório', 'Informe um título para a obra.');
      return;
    }
    setSaving(true);
    try {
      await updateSeriesMetadata(series.id, {
        title: trimmedTitle,
        description: description.trim() || null,
        genre: genre.trim() || null,
        author: author.trim() || null,
        coverPath: coverPath ?? null,
      });
      // Replace (not back()) so this also works when arriving fresh from "Criar obra",
      // which has no series-detail screen underneath it on the navigation stack yet.
      router.replace(`/series/${series.id}`);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer topInset={false}>
        <Stack.Screen options={{ headerShown: true, title: 'Editar obra' }} />
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer topInset={false}>
      <Stack.Screen options={{ headerShown: true, title: 'Editar obra' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Pressable
            style={[styles.coverPicker, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={handlePickCover}
            disabled={pickingCover}>
            {pickingCover ? (
              <ActivityIndicator color={colors.accent} />
            ) : coverPath ? (
              <Image source={{ uri: coverPath }} style={styles.coverImage} contentFit="cover" />
            ) : (
              <Ionicons name="image-outline" size={28} color={colors.textMuted} />
            )}
            <View style={[styles.coverBadge, { backgroundColor: colors.accent }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>

          {providerWorkSlug ? (
            <Pressable
              style={[styles.syncButton, { borderColor: colors.accent }]}
              disabled={syncing}
              onPress={() => void handleSyncWithProvider()}>
              {syncing ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Ionicons name="sync-outline" size={16} color={colors.accent} />
              )}
              <Text style={[styles.syncButtonText, { color: colors.accent }]}>
                {syncing ? 'Sincronizando...' : `Sincronizar com ${session?.domain}`}
              </Text>
            </Pressable>
          ) : null}

          <Text style={[styles.label, { color: colors.textMuted }]}>Título</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Título da obra"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Gênero</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={genre}
            onChangeText={setGenre}
            placeholder="Ex: Ação, Romance, Fantasia"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Autor</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            value={author}
            onChangeText={setAuthor}
            placeholder="Nome do autor"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Sinopse da obra"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            disabled={saving}
            onPress={() => void handleSave()}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 32,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 4,
  },
  coverPicker: {
    alignSelf: 'center',
    width: 130,
    height: 184,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
  },
  saveButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
