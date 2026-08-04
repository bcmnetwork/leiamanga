import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useContentProviderStore } from '@/src/state/contentProviderStore';
import { useDownloadSettingsStore } from '@/src/state/downloadSettingsStore';
import { useNewsFeedStore } from '@/src/state/newsFeedStore';
import { useAppTheme } from '@/src/theme';

function TabIcon({
  ios,
  fallback,
  color,
}: {
  ios: SymbolViewProps['name'];
  fallback: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={ios} tintColor={color} size={26} />;
  }
  return <Ionicons name={fallback} size={26} color={color} />;
}

export default function TabLayout() {
  const { colors } = useAppTheme();
  const { session, hydrate } = useContentProviderStore();
  const hydrateDownloadSettings = useDownloadSettingsStore((state) => state.hydrate);
  const { hydrate: hydrateNewsFeed, checkForUnread, hasUnread } = useNewsFeedStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void hydrateDownloadSettings();
  }, [hydrateDownloadSettings]);

  useEffect(() => {
    void (async () => {
      await hydrateNewsFeed();
      void checkForUnread();
    })();
  }, [hydrateNewsFeed, checkForUnread]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        // Each tab screen renders its own header inside ScreenContainer,
        // so the native stack header must stay hidden to avoid a duplicated
        // title and a wasted gap at the top of the screen.
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Biblioteca',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="books.vertical" fallback="library" color={color} />
          ),
        }}
      />
      {/* Only shown once a site is connected — otherwise there's nothing to browse yet,
          and connecting is reached from a row inside Ajustes. */}
      <Tabs.Screen
        name="providers"
        options={{
          href: session ? undefined : null,
          title: 'Provedor',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="globe" fallback="globe-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Notícias',
          tabBarBadge: hasUnread ? '' : undefined,
          tabBarBadgeStyle: styles.newsBadge,
          tabBarIcon: ({ color }) => (
            <TabIcon ios="newspaper" fallback="newspaper-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => (
            <TabIcon ios="gearshape" fallback="settings-outline" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  newsBadge: {
    minWidth: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 2,
  },
});

