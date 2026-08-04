/**
 * Local HTTP server that lets the user open a URL from a computer's browser
 * (same Wi-Fi network) and upload CBZ files straight into the phone's library
 * — no cable, no cloud account needed.
 *
 * Security model: the server only exposes two routes (an upload page and an
 * upload endpoint) — there is no file-listing or arbitrary file-read endpoint,
 * so a connected device can only ever push new manga files in, never browse
 * or read anything else on the phone. Both routes additionally require a
 * short PIN (generated fresh each time the server is started) so a stranger
 * on the same public/shared Wi-Fi network can't discover the URL and use it.
 *
 * IMPORTANT: this relies on a native module (`react-native-http-bridge-refurbished`)
 * that Expo Go cannot load. It only works in a custom dev client / standalone
 * build produced with `npx expo run:android` (or an EAS build), never in Expo Go.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { BridgeServer } from 'react-native-http-bridge-refurbished';

import { importCbzFromUri } from '@/src/cbz/importCbz';
import { base64ToBytes } from '@/src/utils/base64';

export const UPLOAD_SERVER_PORT = 8098;

export interface UploadServerHandle {
  stop: () => void;
}

export interface UploadResult {
  name: string;
  ok: boolean;
  message?: string;
}

/** Generates a fresh 6-digit PIN — regenerated every time the server starts, never persisted. */
export function generateUploadPassword(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function pathOf(rawUrl: string): string {
  const qIndex = rawUrl.indexOf('?');
  return qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
}

function queryParam(rawUrl: string, key: string): string | null {
  const qIndex = rawUrl.indexOf('?');
  if (qIndex === -1) return null;
  for (const pair of rawUrl.slice(qIndex + 1).split('&')) {
    const [k, v] = pair.split('=');
    if (decodeURIComponent(k ?? '') === key) return decodeURIComponent(v ?? '');
  }
  return null;
}

/** Strips any path components / unsafe characters so the upload can never write outside the uploads folder. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'arquivo.cbz';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || 'arquivo.cbz';
}

function passwordPromptHtml(wrongAttempt: boolean): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Leia Manga — Senha necessária</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0f0b1f; color: #fff; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p { color: #b7b2c9; font-size: 14px; }
  form { margin-top: 20px; display: flex; gap: 8px; }
  input { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid #4d4468; background: #1b1630; color: #fff; font-size: 16px; }
  button { padding: 10px 16px; border-radius: 8px; border: none; background: #7c5cff; color: #fff; font-weight: 700; }
  .err { color: #ff7b7b; font-size: 13px; }
</style>
</head>
<body>
  <h1>Leia Manga</h1>
  <p>Informe o PIN mostrado no aparelho para acessar o envio de arquivos.</p>
  ${wrongAttempt ? '<p class="err">PIN incorreto. Tente novamente.</p>' : ''}
  <form method="GET" action="/">
    <input name="pw" inputmode="numeric" maxlength="6" placeholder="PIN de 6 dígitos" autofocus />
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`;
}

function uploadPageHtml(password: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Enviar obras — Leia Manga</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0f0b1f; color: #fff; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p { color: #b7b2c9; font-size: 14px; }
  .drop { border: 2px dashed #4d4468; border-radius: 12px; padding: 32px; text-align: center; margin-top: 20px; }
  input[type=file] { margin-top: 12px; }
  ul { list-style: none; padding: 0; margin-top: 20px; }
  li { padding: 10px 12px; border-radius: 8px; background: #1b1630; margin-bottom: 8px; font-size: 13px; display: flex; justify-content: space-between; gap: 8px; }
  .ok { color: #7ee787; }
  .err { color: #ff7b7b; }
  .pending { color: #b7b2c9; }
</style>
</head>
<body>
  <h1>Enviar obras (.cbz)</h1>
  <p>Escolha um ou mais arquivos .cbz para enviar para o app pelo Wi-Fi.</p>
  <div class="drop">
    <input id="file" type="file" accept=".cbz,.zip" multiple />
  </div>
  <ul id="log"></ul>
  <script>
    const PASSWORD = ${JSON.stringify(password)};
    const fileInput = document.getElementById('file');
    const log = document.getElementById('log');

    function addRow(name) {
      const li = document.createElement('li');
      li.id = 'row-' + name.replace(/[^a-zA-Z0-9]/g, '_');
      li.innerHTML = '<span>' + name + '</span><span class="pending">Enviando…</span>';
      log.prepend(li);
      return li;
    }

    function toBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function uploadFile(file) {
      const row = addRow(file.name);
      try {
        const data = await toBase64(file);
        const res = await fetch('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data, password: PASSWORD }),
        });
        const json = await res.json();
        row.querySelector('span:last-child').outerHTML = json.ok
          ? '<span class="ok">Enviado ✓</span>'
          : '<span class="err">Falhou: ' + (json.message || 'erro') + '</span>';
      } catch (e) {
        row.querySelector('span:last-child').outerHTML = '<span class="err">Falhou: ' + e + '</span>';
      }
    }

    fileInput.addEventListener('change', () => {
      Array.from(fileInput.files).forEach(uploadFile);
      fileInput.value = '';
    });
  </script>
</body>
</html>`;
}

/**
 * Starts the local upload server. `onResult` is called once per received file
 * (success or failure) so the UI can keep a log. `password` gates both routes.
 */
export function startUploadServer(onResult: (result: UploadResult) => void, password: string): UploadServerHandle {
  const server = new BridgeServer('leiamanga_upload', true);

  // A single catch-all handler is used instead of server.get()/post() (which match
  // the raw request URL verbatim, query string included) so the `?pw=` query param
  // can be parsed manually for the password gate.
  server.use(async (req, res) => {
    const path = pathOf(req.url);

    if (req.type === 'GET' && path === '/') {
      const pw = queryParam(req.url, 'pw');
      if (pw !== password) {
        res.html(passwordPromptHtml(pw !== null));
        return;
      }
      res.html(uploadPageHtml(password));
      return;
    }

    if (req.type === 'POST' && path === '/upload') {
      const body = req.data as { name?: string; data?: string; password?: string } | undefined;
      if (body?.password !== password) {
        res.json({ ok: false, message: 'PIN incorreto.' }, 401);
        return;
      }

      const displayName = body?.name ?? `arquivo-${Date.now()}.cbz`;
      const base64 = body?.data;

      if (!base64) {
        onResult({ name: displayName, ok: false, message: 'Arquivo vazio.' });
        res.json({ ok: false, message: 'Arquivo vazio.' });
        return;
      }

      try {
        const bytes = base64ToBytes(base64);
        const tmpDir = new Directory(Paths.cache, 'uploads');
        tmpDir.create({ intermediates: true, idempotent: true });
        const tmpFile = new File(tmpDir, sanitizeFileName(displayName));
        tmpFile.write(bytes);

        await importCbzFromUri(tmpFile.uri, displayName);

        tmpFile.delete();
        onResult({ name: displayName, ok: true });
        res.json({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao importar o arquivo.';
        onResult({ name: displayName, ok: false, message });
        res.json({ ok: false, message });
      }
      return;
    }

    res.json({ ok: false, message: 'Não encontrado.' }, 404);
  });

  server.listen(UPLOAD_SERVER_PORT);

  return {
    stop: () => server.stop(),
  };
}

