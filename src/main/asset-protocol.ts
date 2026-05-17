import { protocol, net } from 'electron';
import { pathToFileURL } from 'node:url';
import { listAvatars } from './avatars.js';
import { createLogger } from './logger.js';

const log = createLogger('asset-protocol');

export const ASSET_PROTOCOL = 'babaavatar-asset';

export function registerAssetProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: false,
        stream: true,
      },
    },
  ]);
}

export function registerAssetProtocol(): void {
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'avatar') {
      return new Response('Not Found', { status: 404 });
    }
    const id = url.pathname.replace(/^\//, '');
    const avatar = listAvatars().find((a) => a.id === id);
    if (!avatar) {
      log.warn('Asset-Request für unbekannte Avatar-ID', { id });
      return new Response('Avatar nicht gefunden', { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(avatar.filePath).toString());
    } catch (err) {
      log.error('Asset-Auslieferung fehlgeschlagen', err, { id });
      return new Response('Fehler beim Laden', { status: 500 });
    }
  });
  log.info('Asset-Protokoll registriert', { scheme: ASSET_PROTOCOL });
}

export function avatarAssetUrl(id: string): string {
  return `${ASSET_PROTOCOL}://avatar/${id}`;
}
