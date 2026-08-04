# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Project runs on Expo SDK 54 (downgraded from 57→56→54 on 2026-08-03/04 because the installed Expo Go app — per its own Settings screen — only supports SDK 54).

Node.js v24's native TypeScript type-stripping can't `require()` config plugins that ship raw `.ts` main entries (affects expo-image, expo-status-bar, expo-sqlite, expo-document-picker, expo-font, expo-web-browser at this SDK). Workaround: these trivial plugins were removed from `app.json`'s `plugins` array (only `expo-router` and `expo-splash-screen` remain) since Expo Go doesn't need their native config-plugin injection. If you ever need a custom EAS/dev-client build, you may need to restore them and build with an older Node.js version.

## Local upload server (2026 — requires leaving Expo Go)

`src/services/uploadServer/uploadServerService.ts` uses `react-native-http-bridge-refurbished` to run an on-device HTTP server so a computer on the same Wi-Fi can upload `.cbz` files straight into the phone's library (`app/settings/upload-server.tsx`). This is a real native module Expo Go cannot load — testing/building this feature (and the app in general, from now on) requires a custom dev client / standalone build (`npx expo run:android` or an EAS build), not Expo Go. The `android/` folder is already checked into this repo and pre-built once before, so a rebuild should mostly just need autolinking to pick up the new dependency.

Security: the server exposes only 2 routes (upload page + upload endpoint, no file-listing/read routes), both gated behind a 6-digit PIN generated fresh on each server start (never persisted) — see `generateUploadPassword()`. The settings screen also warns about public/shared Wi-Fi before allowing the switch to turn on. Uploaded file names are sanitized (basename + charset allowlist) before being used as a filesystem path, to prevent path traversal.

