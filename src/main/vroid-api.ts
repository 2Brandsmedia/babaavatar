import { app, shell, BrowserWindow } from 'electron';
import crypto from 'node:crypto';
import * as settings from './settings.js';
import { createLogger } from './logger.js';

const log = createLogger('vroid-api');

const PROTOCOL = 'babaavatar';
const AUTHORIZATION_URL = 'https://hub.vroid.com/oauth/authorize';
const TOKEN_URL = 'https://hub.vroid.com/oauth/token';
const API_BASE = 'https://hub.vroid.com/api';

const CLIENT_ID = process.env['VROID_CLIENT_ID'] ?? '';
const CLIENT_SECRET = process.env['VROID_CLIENT_SECRET'] ?? '';
const REDIRECT_URI = `${PROTOCOL}://oauth-callback`;

interface PendingAuth {
  codeVerifier: string;
  state: string;
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

let pending: PendingAuth | null = null;

export function isVroidConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function registerVroidProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2 && process.argv[1]) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
  log.info('VRoid OAuth Protokoll registriert');
}

export function handleOpenUrl(url: string): void {
  if (!url.startsWith(`${PROTOCOL}://oauth-callback`)) return;
  if (!pending) {
    log.warn('OAuth-Callback ohne pending Auth empfangen');
    return;
  }
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  const returnedState = parsed.searchParams.get('state');
  if (!code || returnedState !== pending.state) {
    pending.reject(new Error('OAuth-Callback ungültig'));
    pending = null;
    return;
  }
  const verifier = pending.codeVerifier;
  exchangeCodeForToken(code, verifier)
    .then((token) => {
      pending?.resolve(token);
      pending = null;
    })
    .catch((err: Error) => {
      pending?.reject(err);
      pending = null;
    });
}

export function startOAuthFlow(): Promise<string> {
  if (!isVroidConfigured()) {
    return Promise.reject(
      new Error(
        'VRoid Hub Client-ID/Secret nicht konfiguriert. Setze VROID_CLIENT_ID und VROID_CLIENT_SECRET als Env-Variablen.',
      ),
    );
  }

  return new Promise<string>((resolve, reject) => {
    if (pending) {
      pending.reject(new Error('Vorherige Anmeldung abgebrochen'));
    }
    const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
    const challenge = base64UrlEncode(
      crypto.createHash('sha256').update(codeVerifier).digest(),
    );
    const state = base64UrlEncode(crypto.randomBytes(16));
    pending = { codeVerifier, state, resolve, reject };

    const url = new URL(AUTHORIZATION_URL);
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'default');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    void shell.openExternal(url.toString());
  });
}

export async function listCharacters(): Promise<unknown[]> {
  const token = settings.get('vroidAccessToken');
  if (!token) throw new Error('Kein VRoid Hub Access Token vorhanden');
  const response = await fetch(`${API_BASE}/character_models`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Api-Version': '11',
    },
  });
  if (!response.ok) throw new Error(`API-Fehler: ${response.status}`);
  const json = (await response.json()) as { data?: unknown[] };
  return json.data ?? [];
}

export function logout(): void {
  settings.set('vroidAccessToken', null);
  log.info('VRoid Logout');
}

async function exchangeCodeForToken(code: string, verifier: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: verifier,
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`Token-Tausch fehlgeschlagen: ${response.status}`);
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Token fehlt in Antwort');
  settings.set('vroidAccessToken', json.access_token);
  return json.access_token;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function focusControlForCallback(): void {
  const wins = BrowserWindow.getAllWindows();
  const main = wins[0];
  if (main && !main.isDestroyed()) {
    if (main.isMinimized()) main.restore();
    main.focus();
  }
}
