import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { importCbzFromUri } from '@/src/cbz/importCbz';
import { migrateDatabase } from '@/src/db/schema';
import { useThemeStore } from '@/src/state/themeStore';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [dbReady, setDbReady] = useState(false);
  const themeHydrated = useThemeStore((state) => state.hydrated);
  const hydrateTheme = useThemeStore((state) => state.hydrate);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    migrateDatabase()
      .then(() => setDbReady(true))
      .catch((migrationError) => {
        console.error('Falha ao migrar banco de dados', migrationError);
        setDbReady(true);
      });
    void hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    if (loaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbReady]);

  if (!loaded || !dbReady || !themeHydrated) {
    // Mirrors the native splash (same background/icon) so there's no blank
    // flash between the native splash hiding and the app finishing setup.
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('../assets/images/icon.png')} style={styles.loadingIcon} contentFit="contain" />
        <ActivityIndicator style={styles.loadingSpinner} color="#fff" />
      </View>
    );
  }

  return <RootLayoutNav />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0B1F',
  },
  loadingIcon: {
    width: 96,
    height: 96,
    borderRadius: 20,
  },
  loadingSpinner: {
    marginTop: 24,
  },
});


function RootLayoutNav() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const colorScheme = preference === 'system' ? systemScheme : preference;
  const router = useRouter();

  // Best-effort: if the OS opened this app with an incoming .cbz file (e.g. "open with" from a
  // file manager, once the native file-association intent-filters are registered), import it
  // straight into the library instead of trying to render it as a normal app route.
  useEffect(() => {
    function guessFileName(url: string): string {
      const lastSegment = url.split('/').pop() ?? 'capitulo.cbz';
      try {
        return decodeURIComponent(lastSegment);
      } catch {
        return lastSegment;
      }
    }

    async function handleIncomingUrl(url: string | null) {
      if (!url) return;
      // Ignore our own custom scheme and the Expo dev-client/Expo Go launch URL.
      if (url.startsWith('appleiamanga://') || url.startsWith('exp://') || url.startsWith('exp+')) return;
      try {
        await importCbzFromUri(url, guessFileName(url));
        router.replace('/(tabs)');
      } catch {
        Alert.alert('Erro ao abrir arquivo', 'Não foi possível importar este arquivo CBZ.');
      }
    }

    void Linking.getInitialURL().then(handleIncomingUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => void handleIncomingUrl(url));
    return () => subscription.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            // Avoids the back button falling back to the raw route name (e.g.
            // "(tabs)") as its label on iOS when the previous screen has no
            // explicit title — show just the chevron instead.
            headerBackButtonDisplayMode: 'minimal',
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="series/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="series/edit/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="reader/[chapterId]" options={{ headerShown: false }} />
          <Stack.Screen name="provider/[slug]" options={{ headerShown: true }} />
          <Stack.Screen name="provider-reader/[chapterId]" options={{ headerShown: false }} />
          <Stack.Screen name="settings/reading" options={{ headerShown: true }} />
          <Stack.Screen name="settings/storage" options={{ headerShown: true }} />
          <Stack.Screen name="settings/appearance" options={{ headerShown: true }} />
          <Stack.Screen name="settings/trackers" options={{ headerShown: true }} />
          <Stack.Screen name="settings/news" options={{ headerShown: true }} />
          <Stack.Screen name="settings/upload-server" options={{ headerShown: true }} />
          <Stack.Screen name="downloads" options={{ headerShown: true }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

