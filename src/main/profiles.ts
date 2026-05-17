import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AvatarProfile } from '../shared/types.js';
import { createLogger } from './logger.js';

const log = createLogger('profiles');

function profilesDir(): string {
  return path.join(app.getPath('userData'), 'profiles');
}

function profilePath(avatarId: string): string {
  return path.join(profilesDir(), `${avatarId}.json`);
}

const defaultProfile = (avatarId: string): AvatarProfile => ({
  avatarId,
  calibration: {
    neutralPose: null,
    mouthOpenMax: null,
    mouthClosedMin: null,
    eyeOpenMax: null,
    eyeClosedMin: null,
    browUpMax: null,
    browDownMin: null,
    smileMax: null,
  },
  cameraPosition: { x: 0, y: 1.4, z: 1.6 },
  cameraFov: 30,
  avatarScale: 1,
  hotkeys: [],
});

export async function getProfile(avatarId: string): Promise<AvatarProfile> {
  try {
    const buffer = await fs.readFile(profilePath(avatarId), 'utf-8');
    const parsed = JSON.parse(buffer) as AvatarProfile;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultProfile(avatarId);
    }
    log.warn('Profil-Lesen fehlgeschlagen', { avatarId, err: String(err) });
    return defaultProfile(avatarId);
  }
}

export async function setProfile(profile: AvatarProfile): Promise<AvatarProfile> {
  await fs.mkdir(profilesDir(), { recursive: true });
  await fs.writeFile(profilePath(profile.avatarId), JSON.stringify(profile, null, 2));
  log.info('Profil gespeichert', { avatarId: profile.avatarId });
  return profile;
}
