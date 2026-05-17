import fs from 'node:fs/promises';
import type { VrmLicense, VrmLicenseLevel } from '../shared/types.js';
import { createLogger } from './logger.js';

const log = createLogger('vrm-license');

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;

export async function readVrmLicense(filePath: string): Promise<VrmLicense | null> {
  const buffer = await fs.readFile(filePath);
  return parseVrmLicense(buffer);
}

export function parseVrmLicense(buffer: Buffer): VrmLicense | null {
  if (buffer.byteLength < 20) {
    log.warn('Datei zu klein für GLB-Container');
    return null;
  }

  const magic = buffer.readUInt32LE(0);
  if (magic !== GLB_MAGIC) {
    log.warn('Magic-Number stimmt nicht (kein gültiges glTF/VRM)', { magic: magic.toString(16) });
    return null;
  }

  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);
  if (jsonChunkType !== JSON_CHUNK_TYPE) {
    log.warn('Erster Chunk ist kein JSON');
    return null;
  }

  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonChunkLength;
  if (jsonEnd > buffer.byteLength) {
    log.warn('JSON-Chunk reicht über Buffer hinaus');
    return null;
  }

  const jsonText = buffer.subarray(jsonStart, jsonEnd).toString('utf-8');
  let json: unknown;
  try {
    json = JSON.parse(jsonText);
  } catch (err) {
    log.error('VRM-JSON-Parsing fehlgeschlagen', err);
    return null;
  }

  return extractLicense(json);
}

interface GltfRoot {
  extensions?: {
    VRM?: VrmZeroMeta;
    VRMC_vrm?: VrmOneMeta;
  };
}

interface VrmZeroMeta {
  meta?: {
    title?: string;
    author?: string;
    version?: string;
    allowedUserName?: string;
    violentUssageName?: string;
    sexualUssageName?: string;
    commercialUssageName?: string;
    otherPermissionUrl?: string;
    licenseName?: string;
    otherLicenseUrl?: string;
  };
}

interface VrmOneMeta {
  meta?: {
    name?: string;
    authors?: string[];
    version?: string;
    avatarPermission?: string;
    violentUsage?: boolean;
    sexualUsage?: boolean;
    commercialUsage?: string;
    otherLicenseUrl?: string;
    licenseUrl?: string;
  };
}

function extractLicense(json: unknown): VrmLicense | null {
  if (!isGltfRoot(json)) return null;
  const ext = json.extensions ?? {};
  if (ext.VRMC_vrm?.meta) {
    return convertVrmOne(ext.VRMC_vrm.meta);
  }
  if (ext.VRM?.meta) {
    return convertVrmZero(ext.VRM.meta);
  }
  return null;
}

function convertVrmZero(meta: NonNullable<VrmZeroMeta['meta']>): VrmLicense {
  const notes: string[] = [];
  const allowed = meta.allowedUserName ?? null;
  const commercial = meta.commercialUssageName ?? null;
  const violent = meta.violentUssageName ?? null;
  const sexual = meta.sexualUssageName ?? null;
  const licenseName = meta.licenseName ?? null;

  if (allowed === 'OnlyAuthor') notes.push('Nur der Autor darf diesen Avatar nutzen.');
  if (commercial === 'Disallow') notes.push('Kommerzielle Nutzung nicht erlaubt.');
  if (violent === 'Disallow') notes.push('Darstellung von Gewalt nicht erlaubt.');
  if (sexual === 'Disallow') notes.push('Darstellung sexueller Inhalte nicht erlaubt.');
  if (licenseName === 'Redistribution_Prohibited') notes.push('Weitergabe verboten.');

  return {
    level: classifyLevel({ allowed, commercial, licenseName, vrmOne: false }),
    allowedUser: allowed,
    commercialUse: commercial,
    violentUse: violent,
    sexualUse: sexual,
    licenseName,
    otherPermissionUrl: meta.otherPermissionUrl ?? null,
    author: meta.author ?? null,
    title: meta.title ?? null,
    version: meta.version ?? null,
    notesForUser: notes,
  };
}

function convertVrmOne(meta: NonNullable<VrmOneMeta['meta']>): VrmLicense {
  const notes: string[] = [];
  const allowed = meta.avatarPermission ?? null;
  const commercial = meta.commercialUsage ?? null;
  const violent = meta.violentUsage === true ? 'Allow' : meta.violentUsage === false ? 'Disallow' : null;
  const sexual = meta.sexualUsage === true ? 'Allow' : meta.sexualUsage === false ? 'Disallow' : null;
  const licenseName = meta.licenseUrl ?? null;

  if (allowed === 'onlyAuthor') notes.push('Nur der Autor darf diesen Avatar nutzen.');
  if (commercial === 'personalNonProfit') notes.push('Nur für persönliche, nicht-kommerzielle Nutzung.');
  if (violent === 'Disallow') notes.push('Darstellung von Gewalt nicht erlaubt.');
  if (sexual === 'Disallow') notes.push('Darstellung sexueller Inhalte nicht erlaubt.');

  return {
    level: classifyLevel({ allowed, commercial, licenseName, vrmOne: true }),
    allowedUser: allowed,
    commercialUse: commercial,
    violentUse: violent,
    sexualUse: sexual,
    licenseName,
    otherPermissionUrl: meta.otherLicenseUrl ?? null,
    author: meta.authors?.[0] ?? null,
    title: meta.name ?? null,
    version: meta.version ?? null,
    notesForUser: notes,
  };
}

interface ClassifyInput {
  allowed: string | null;
  commercial: string | null;
  licenseName: string | null;
  vrmOne: boolean;
}

function classifyLevel(input: ClassifyInput): VrmLicenseLevel {
  if (input.licenseName === 'Redistribution_Prohibited') return 'forbidden';
  if (input.allowed === 'OnlyAuthor' || input.allowed === 'onlyAuthor') return 'forbidden';

  if (input.vrmOne) {
    if (input.commercial === 'allow' || input.commercial === 'personalProfit') return 'open';
    if (input.commercial === 'personalNonProfit') return 'restricted';
    return 'restricted';
  }

  if (input.commercial === 'Allow') return 'open';
  if (input.commercial === 'Disallow') return 'restricted';
  return 'restricted';
}

function isGltfRoot(value: unknown): value is GltfRoot {
  return typeof value === 'object' && value !== null;
}
