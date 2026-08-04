import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ScreenContainer } from '@/src/components/common/ScreenContainer';
import {
    getCatalog,
    getCategories,
    getGenres,
    getLibrary,
    type ProviderCategory,
    type ProviderWorkSummary,
} from '@/src/services/contentProvider/ContentCatalogService';
import { ProviderConnectionError } from '@/src/services/contentProvider/ContentProviderService';
import { useContentProviderStore } from '@/src/state/contentProviderStore';
import { useAppTheme } from '@/src/theme';

type BrowseView = 'catalog' | 'library';
type SortOption = 'relevance' | 'title_asc' | 'title_desc' | 'chapters_desc';
type WorkListItem = { slug: string; title: string; coverUrl: string | null; type?: string; chapterCount?: number };

const SORT_OPTIONS: { key: SortOption; label: string; apiSort?: string }[] = [
  { key: 'relevance', label: 'Padrão' },
  { key: 'title_asc', label: 'A-Z', apiSort: 'title' },
  { key: 'title_desc', label: 'Z-A', apiSort: '-title' },
  { key: 'chapters_desc', label: 'Mais capítulos', apiSort: '-chapters' },
];

// Local display names for the most common genre slugs returned by the API
// (which are accent/case-stripped, e.g. "acao"). Anything not listed here
// falls back to a simple capitalized version of the slug.
const GENRE_LABELS: Record<string, string> = {
  acao: 'Ação', aventura: 'Aventura', comedia: 'Comédia', drama: 'Drama',
  fantasia: 'Fantasia', horror: 'Horror', terror: 'Terror', misterio: 'Mistério',
  romance: 'Romance', 'sci-fi': 'Sci-Fi', 'slice-of-life': 'Slice of Life',
  sobrenatural: 'Sobrenatural', esportes: 'Esportes', shounen: 'Shounen',
  shoujo: 'Shoujo', seinen: 'Seinen', josei: 'Josei', isekai: 'Isekai',
  psicologico: 'Psicológico', thriller: 'Thriller', historico: 'Histórico',
  murim: 'Murim', xinxia: 'Xinxia', mecha: 'Mecha', yaoi: 'Yaoi', yuri: 'Yuri',
};

function genreLabel(slug: string): string {
  return GENRE_LABELS[slug] ?? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function ProvidersScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const {
    session,
    hydrated,
    connecting,
    disconnecting,
    error,
    hydrate,
    connect,
    disconnect,
    clearError,
  } = useContentProviderStore();

  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [view, setView] = useState<BrowseView>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [catalog, setCatalog] = useState<ProviderWorkSummary[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const [categories, setCategories] = useState<ProviderCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  const [library, setLibrary] = useState<{ workSlug: string; workTitle: string }[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const loadCatalog = useCallback(
    async (page: number, query: string, genre: string | null, category: string | null, sort: SortOption) => {
      if (!session) return;
      if (page === 1) {
        setLoadingCatalog(true);
      } else {
        setLoadingMore(true);
      }
      setCatalogError(null);
      try {
        const result = await getCatalog(session, {
          q: query || undefined,
          page,
          limit: 24,
          genre: genre ?? undefined,
          type: category ?? undefined,
          sort: SORT_OPTIONS.find((o) => o.key === sort)?.apiSort,
        });
        setCatalog((prev) => (page === 1 ? result.items : [...prev, ...result.items]));
        setCatalogPage(result.page);
        setCatalogTotalPages(result.totalPages);
      } catch (err) {
        setCatalogError(
          err instanceof ProviderConnectionError ? err.message : 'Não foi possível carregar o catálogo do site.'
        );
        if (page === 1) setCatalog([]);
      } finally {
        setLoadingCatalog(false);
        setLoadingMore(false);
      }
    },
    [session]
  );

  useEffect(() => {
    if (session) void loadCatalog(1, '', null, null, 'relevance');
    // Only run when the session first becomes available — subsequent loads are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const list = await getGenres(session).catch(() => []);
      if (!cancelled) setGenres(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const list = await getCategories(session).catch(() => []);
      if (!cancelled) setCategories(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const loadLibrary = useCallback(async () => {
    if (!session) return;
    setLoadingLibrary(true);
    try {
      const items = await getLibrary(session);
      setLibrary(items);
    } catch {
      // Non-critical — the saved list just stays empty/stale.
    } finally {
      setLoadingLibrary(false);
    }
  }, [session]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const handleConnect = async () => {
    const ok = await connect(domain, email, password);
    if (ok) {
      setPassword('');
    }
  };

  function handleSearchSubmit() {
    Keyboard.dismiss();
    void loadCatalog(1, searchQuery.trim(), selectedGenre, selectedCategory, sortBy);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (!value.trim()) {
      void loadCatalog(1, '', selectedGenre, selectedCategory, sortBy);
    }
  }

  function handleSelectGenre(genre: string) {
    const next = selectedGenre === genre ? null : genre;
    setSelectedGenre(next);
    void loadCatalog(1, searchQuery.trim(), next, selectedCategory, sortBy);
  }

  function handleSelectCategory(category: string) {
    const next = selectedCategory === category ? null : category;
    setSelectedCategory(next);
    void loadCatalog(1, searchQuery.trim(), selectedGenre, next, sortBy);
  }

  function handleSelectSort(sort: SortOption) {
    setSortBy(sort);
    void loadCatalog(1, searchQuery.trim(), selectedGenre, selectedCategory, sort);
  }

  function handleLoadMore() {
    if (loadingCatalog || loadingMore || catalogPage >= catalogTotalPages) return;
    void loadCatalog(catalogPage + 1, searchQuery.trim(), selectedGenre, selectedCategory, sortBy);
  }

  function handleSwitchView(next: BrowseView) {
    setView(next);
    if (next === 'library') void loadLibrary();
  }

  const catalogItems: WorkListItem[] = catalog.map((w) => ({
    slug: w.slug,
    title: w.title,
    coverUrl: w.coverUrl,
    type: w.type,
    chapterCount: w.chapterCount,
  }));
  const libraryItems: WorkListItem[] = Array.from(
    new Map(library.map((l) => [l.workSlug, { slug: l.workSlug, title: l.workTitle, coverUrl: null }])).values()
  );
  // Client-side sort applied on top of whatever the server returned, so ordering
  // stays correct across accumulated pages even if the API ignores the `sort` param.
  const listData =
    view === 'catalog'
      ? [...catalogItems].sort((a, b) => {
          if (sortBy === 'title_desc') return b.title.localeCompare(a.title, 'pt-BR');
          if (sortBy === 'chapters_desc') return (b.chapterCount ?? 0) - (a.chapterCount ?? 0);
          if (sortBy === 'relevance') return 0;
          return a.title.localeCompare(b.title, 'pt-BR');
        })
      : [...libraryItems].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  const listLoading = view === 'catalog' ? loadingCatalog : loadingLibrary;
  const listError = view === 'catalog' ? catalogError : null;
  const activeCategoryLabel = categories.find((c) => c.slug === selectedCategory)?.label ?? selectedCategory;
  const hasActiveFilters = Boolean(selectedCategory || selectedGenre);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Site conectado
        </Text>
        {session && view === 'catalog' ? (
          <Pressable
            hitSlop={8}
            style={[styles.filterButton, { borderColor: colors.border }, hasActiveFilters && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={18} color={hasActiveFilters ? colors.background : colors.text} />
          </Pressable>
        ) : null}
      </View>

      {!hydrated ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : session ? (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.4}
          onEndReached={view === 'catalog' ? handleLoadMore : undefined}
          ListHeaderComponent={
            <>
              <View style={[styles.connectedBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
                <Text style={[styles.connectedBannerText, { color: colors.text }]} numberOfLines={1}>
                  {session.domain}
                </Text>
                <Pressable hitSlop={8} disabled={disconnecting} onPress={() => void disconnect()}>
                  {disconnecting ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                  )}
                </Pressable>
              </View>

              <View style={[styles.searchBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  placeholder="Buscar obras no site"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleSearchSubmit}
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {loadingCatalog ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              </View>

              {view === 'catalog' && hasActiveFilters ? (
                <View style={styles.activeFiltersRow}>
                  {selectedCategory ? (
                    <Pressable
                      style={[styles.activeFilterChip, { backgroundColor: colors.accent }]}
                      onPress={() => handleSelectCategory(selectedCategory)}>
                      <Text style={[styles.activeFilterChipText, { color: colors.background }]} numberOfLines={1}>
                        {activeCategoryLabel}
                      </Text>
                      <Ionicons name="close" size={13} color={colors.background} />
                    </Pressable>
                  ) : null}
                  {selectedGenre ? (
                    <Pressable
                      style={[styles.activeFilterChip, { backgroundColor: colors.accent }]}
                      onPress={() => handleSelectGenre(selectedGenre)}>
                      <Text style={[styles.activeFilterChipText, { color: colors.background }]} numberOfLines={1}>
                        {genreLabel(selectedGenre)}
                      </Text>
                      <Ionicons name="close" size={13} color={colors.background} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={[styles.segmented, { borderColor: colors.border }]}>
                <Pressable
                  style={[styles.segment, view === 'catalog' && { backgroundColor: colors.accent }]}
                  onPress={() => handleSwitchView('catalog')}>
                  <Text style={[styles.segmentText, { color: view === 'catalog' ? colors.background : colors.text }]}>
                    Catálogo
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.segment, view === 'library' && { backgroundColor: colors.accent }]}
                  onPress={() => handleSwitchView('library')}>
                  <Text style={[styles.segmentText, { color: view === 'library' ? colors.background : colors.text }]}>
                    Salvos
                  </Text>
                </Pressable>
              </View>

              {listError ? <Text style={[styles.errorText, { color: colors.danger }]}>{listError}</Text> : null}
            </>
          }
          ListFooterComponent={
            view === 'catalog' && loadingMore ? (
              <ActivityIndicator style={styles.loading} color={colors.accent} />
            ) : null
          }
          ListEmptyComponent={
            !listLoading ? (
              <EmptyState
                title={view === 'catalog' ? 'Nenhuma obra encontrada' : 'Nada salvo ainda'}
                description={
                  view === 'catalog'
                    ? 'Tente buscar por outro termo ou remover o filtro de gênero.'
                    : 'Abra uma obra no Catálogo e toque em "Salvar para ler depois".'
                }
              />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.workRow, { borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/provider/[slug]', params: { slug: item.slug } })}>
              <View style={[styles.workCover, { backgroundColor: colors.surfaceAlt }]}>
                {item.coverUrl ? (
                  <Image source={{ uri: item.coverUrl }} style={styles.workCoverImage} contentFit="cover" />
                ) : (
                  <Ionicons name="book-outline" size={20} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.workInfo}>
                <Text style={[styles.workTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.type ? (
                  <Text style={[styles.workType, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.type}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.loginAvoidingView}>
          <ScrollView
            contentContainerStyle={styles.loginScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="cloud-outline" size={30} color={colors.accent} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Conectar a um site</Text>
              <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                Informe o domínio do site, seu e-mail e senha para sincronizar sua biblioteca e
                baixar capítulos pelo app. Contas sem assinatura ativa também podem conectar — nesse
                caso, apenas obras ou capítulos gratuitos ficam disponíveis para leitura.
              </Text>

              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="globe-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.inputRowField, { color: colors.text }]}
                  placeholder="Domínio (ex: meusite.com)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  value={domain}
                  onChangeText={(value) => {
                    setDomain(value);
                    clearError();
                  }}
                />
              </View>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.inputRowField, { color: colors.text }]}
                  placeholder="E-mail"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearError();
                  }}
                />
              </View>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.inputRowField, { color: colors.text }]}
                  placeholder="Senha"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearError();
                  }}
                />
                <Pressable hitSlop={8} onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>

              {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

              <Pressable
                style={[styles.button, styles.primaryButton, { borderColor: colors.accent, backgroundColor: colors.accent }]}
                disabled={connecting || !domain || !email || !password}
                onPress={() => void handleConnect()}>
                {connecting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.background }]}>Conectar</Text>
                )}
              </Pressable>

              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Ao conectar, sua sessão ativa no site (navegador) pode ser encerrada, já que apenas um
                dispositivo pode ficar logado por vez na mesma conta.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={filterModalVisible} animationType="slide" transparent onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterModalVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Ajustar busca</Text>
              <Pressable hitSlop={10} onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollContent}>
              <Text style={[styles.sheetSectionLabel, { color: colors.textMuted }]}>Ordenar por</Text>
              <View style={styles.chipWrap}>
                {SORT_OPTIONS.map((option) => {
                  const active = sortBy === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.genreChip,
                        { borderColor: colors.border },
                        active && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}
                      onPress={() => handleSelectSort(option.key)}>
                      <Text style={[styles.genreChipText, { color: active ? colors.background : colors.text }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {categories.length > 0 ? (
                <>
                  <Text style={[styles.sheetSectionLabel, { color: colors.textMuted }]}>Categoria</Text>
                  <View style={styles.chipWrap}>
                    {categories.map((category) => {
                      const active = selectedCategory === category.slug;
                      return (
                        <Pressable
                          key={category.slug}
                          style={[
                            styles.genreChip,
                            { borderColor: colors.border },
                            active && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                          onPress={() => handleSelectCategory(category.slug)}>
                          <Text style={[styles.genreChipText, { color: active ? colors.background : colors.text }]}>
                            {category.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {genres.length > 0 ? (
                <>
                  <Text style={[styles.sheetSectionLabel, { color: colors.textMuted }]}>Gênero</Text>
                  <View style={styles.chipWrap}>
                    {genres.map((genre) => {
                      const active = selectedGenre === genre;
                      return (
                        <Pressable
                          key={genre}
                          style={[
                            styles.genreChip,
                            { borderColor: colors.border },
                            active && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                          onPress={() => handleSelectGenre(genre)}>
                          <Text style={[styles.genreChipText, { color: active ? colors.background : colors.text }]}>
                            {genreLabel(genre)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Pressable
                style={[styles.button, styles.primaryButton, { borderColor: colors.accent, backgroundColor: colors.accent, marginTop: 20 }]}
                onPress={() => setFilterModalVisible(false)}>
                <Text style={[styles.buttonText, { color: colors.background }]}>Concluído</Text>
              </Pressable>
              {hasActiveFilters ? (
                <Pressable
                  style={styles.clearFiltersButton}
                  onPress={() => {
                    if (selectedCategory) handleSelectCategory(selectedCategory);
                    if (selectedGenre) handleSelectGenre(selectedGenre);
                  }}>
                  <Text style={[styles.clearFiltersText, { color: colors.danger }]}>Limpar filtros</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '700',
  },
  filterButton: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    marginTop: 32,
  },
  loginAvoidingView: {
    flex: 1,
  },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  card: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
  },
  cardIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  inputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputRowField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    marginTop: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  connectedBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 200,
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  sheetSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clearFiltersButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  segmented: {
    flexDirection: 'row',
    marginTop: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  workRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  workCover: {
    width: 40,
    height: 56,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  workCoverImage: {
    width: '100%',
    height: '100%',
  },
  workInfo: {
    flex: 1,
    gap: 2,
  },
  workTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  workType: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
});
