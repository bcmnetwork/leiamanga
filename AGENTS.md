# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Project runs on Expo SDK 54 (downgraded from 57→56→54 on 2026-08-03/04 because the installed Expo Go app — per its own Settings screen — only supports SDK 54).

Node.js v24's native TypeScript type-stripping can't `require()` config plugins that ship raw `.ts` main entries (affects expo-image, expo-status-bar, expo-sqlite, expo-document-picker, expo-font, expo-web-browser at this SDK). Workaround: these trivial plugins were removed from `app.json`'s `plugins` array (only `expo-router` and `expo-splash-screen` remain) since Expo Go doesn't need their native config-plugin injection. If you ever need a custom EAS/dev-client build, you may need to restore them and build with an older Node.js version.
