import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { pickAndImportCbzFiles } from '@/src/cbz/importCbz';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import { SeriesGridItem } from '@/src/components/library/SeriesGridItem';
import { deleteDownloadedSeries } from '@/src/db/libraryMaintenance';
import { toggleFavorite } from '@/src/db/repository';
import { useLibraryStore } from '@/src/state/libraryStore';
import { useAppTheme } from '@/src/theme';

export default function LibraryScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { series, loading, query, favoritesOnly, sortBy, setQuery, setFavoritesOnly, setSortBy, refresh } =
    useLibraryStore();
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Chapters downloaded from a connected provider land here too, so refresh
  // whenever this tab regains focus (not just on first mount).
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function handleImport() {
    setImporting(true);
    try {
      const result = await pickAndImportCbzFiles();
      if (result.imported > 0 || result.failed > 0) {
        Alert.alert(
          'Importação concluída',
          `${result.imported} capítulo(s) importado(s)${result.failed ? `, ${result.failed} falharam` : ''}.`
        );
      }
      if (result.imported > 0) {
        await refresh();
      }
    } catch {
      Alert.alert('Erro ao importar', 'Não foi possível abrir o seletor de arquivos. Tente novamente.');
    } finally {
      setImporting(false);
    }
  }

  async function handleToggleFavorite(seriesId: string) {
    await toggleFavorite(seriesId);
    await refresh();
  }

  function handleDeleteSeries(seriesId: string, title: string) {
    Alert.alert('Remover obra?', `"${title}" e todos os seus capítulos serão removidos do dispositivo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteDownloadedSeries(seriesId);
            await refresh();
          })();
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Biblioteca</Text>
        <Pressable
          style={[styles.importButton, { backgroundColor: colors.accent }]}
          onPress={handleImport}
          disabled={importing}>
          {importing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="add" size={22} color="#fff" />
          )}
        </Pressable>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar na biblioteca"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[
            styles.chip,
            { borderColor: colors.border },
            favoritesOnly && { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
          onPress={() => setFavoritesOnly(!favoritesOnly)}>
          <Ionicons
            name={favoritesOnly ? 'star' : 'star-outline'}
            size={14}
            color={favoritesOnly ? '#fff' : colors.textMuted}
          />
          <Text style={[styles.chipText, { color: favoritesOnly ? '#fff' : colors.textMuted }]}>
            Favoritos
          </Text>
        </Pressable>

        {(
          [
            { key: 'title', label: 'A-Z' },
            { key: 'recent', label: 'Recentes' },
            { key: 'lastRead', label: 'Última leitura' },
          ] as const
        ).map((option) => (
          <Pressable
            key={option.key}
            style={[
              styles.chip,
              { borderColor: colors.border },
              sortBy === option.key && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
            onPress={() => setSortBy(option.key)}>
            <Text style={[styles.chipText, { color: sortBy === option.key ? '#fff' : colors.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {series.length === 0 && !loading ? (
        <EmptyState
          title="Sua biblioteca está vazia"
          description="Toque em + para importar arquivos CBZ do seu dispositivo."
        />
      ) : (
        <FlatList
          data={series}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <SeriesGridItem
              series={item}
              onPress={() => router.push(`/series/${item.id}`)}
              onLongPress={() => handleDeleteSeries(item.id, item.title)}
              onToggleFavorite={() => handleToggleFavorite(item.id)}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  importButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  column: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 32,
  },
});
