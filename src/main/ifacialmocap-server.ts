import dgram from 'node:dgram';
import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { IFACIALMOCAP_HANDSHAKE_MAGIC } from '../shared/constants.js';
import type { VmcSnapshot } from '../shared/types.js';
import { createLogger } from './logger.js';

const log = createLogger('ifacialmocap-server');

const HANDSHAKE_INTERVAL_MS = 1000;
const BROADCAST_INTERVAL_MS = 1000 / 60;

interface ServerHandle {
  port: number;
  stop: () => void;
}

let current: ServerHandle | null = null;
let outputWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
let lastMessageAt = 0;
let lastBroadcastAt = 0;
let lastIphoneIp: string | null = null;
let packetsReceived = 0;
let firstPacketLogged = false;
let parseFailures = 0;
let lastStatsAt = 0;

export function setIfmWindows(windows: {
  controlWindow: BrowserWindow;
  outputWindow: BrowserWindow;
}): void {
  controlWindow = windows.controlWindow;
  outputWindow = windows.outputWindow;
}

export function isIfmRunning(): boolean {
  return current !== null;
}

export function getIfmStatus(): { running: boolean; port: number | null; lastMessageAt: number } {
  return {
    running: current !== null,
    port: current?.port ?? null,
    lastMessageAt,
  };
}

export async function startIfmServer(port: number): Promise<void> {
  await stopIfmServer();

  const socket = dgram.createSocket('udp4');

  socket.on('error', (err) => {
    log.error('iFacialMocap-Socket Fehler', err);
  });

  socket.on('listening', () => {
    log.info('iFacialMocap-Server bereit', { port });
    try {
      socket.setBroadcast(true);
    } catch {
      // ignore
    }
  });

  socket.on('message', (msg, rinfo) => {
    lastIphoneIp = rinfo.address;
    packetsReceived += 1;
    const text = msg.toString('utf-8');
    if (!firstPacketLogged) {
      firstPacketLogged = true;
      log.info('Erstes iPhone-Paket empfangen', {
        from: rinfo.address,
        bytes: msg.length,
        sample: text.length > 1000 ? text.slice(0, 1000) + '...[truncated]' : text,
      });
    }
    handleMessage(text);
  });

  socket.bind(port);

  const handshakeTimer = setInterval(() => {
    const payload = Buffer.from(IFACIALMOCAP_HANDSHAKE_MAGIC, 'utf-8');
    const target = lastIphoneIp ?? '255.255.255.255';
    socket.send(payload, port, target, (err) => {
      if (err && !lastIphoneIp) {
        return;
      }
      if (err) {
        log.warn('Handshake-Send fehlgeschlagen', { err: err.message, target });
      }
    });
    const now = Date.now();
    if (now - lastStatsAt > 5000) {
      lastStatsAt = now;
      log.info('iFacialMocap-Stats', {
        packetsReceived,
        parseFailures,
        lastIphoneIp,
        firstPacketLogged,
      });
    }
  }, HANDSHAKE_INTERVAL_MS);

  current = {
    port,
    stop: () => {
      clearInterval(handshakeTimer);
      try {
        socket.close();
      } catch (err) {
        log.warn('Socket-Close-Fehler', { err: String(err) });
      }
    },
  };
}

export async function stopIfmServer(): Promise<void> {
  if (!current) return;
  current.stop();
  current = null;
  lastIphoneIp = null;
  packetsReceived = 0;
  parseFailures = 0;
  firstPacketLogged = false;
  lastStatsAt = 0;
}

function handleMessage(text: string): void {
  lastMessageAt = Date.now();
  const snapshot = parseIfmPacket(text);
  if (!snapshot) {
    parseFailures += 1;
    if (parseFailures <= 3) {
      log.warn('iFacialMocap-Paket konnte nicht geparsed werden', {
        sample: text.slice(0, 200),
      });
    }
    return;
  }
  const now = Date.now();
  if (now - lastBroadcastAt < BROADCAST_INTERVAL_MS) return;
  lastBroadcastAt = now;
  outputWindow?.webContents.send(IPC.VMC_FRAME, snapshot);
  controlWindow?.webContents.send(IPC.VMC_FRAME, snapshot);
}

export function parseIfmPacket(text: string): VmcSnapshot | null {
  const blendShapes: Record<string, number> = {};
  let headEuler: { x: number; y: number; z: number } | null = null;

  const macroSections = text.split('___iFacialMocap');
  for (const macro of macroSections) {
    const sections = macro.split(/[|&]/);
    for (const rawSection of sections) {
      const section = rawSection.trim();
      if (!section) continue;

      if (section.startsWith('=head#') || section.startsWith('head#')) {
        const payload = section.replace(/^=?head#/, '');
        const parsed = parseTriplet(payload);
        if (parsed) {
          const deg2rad = Math.PI / 180;
          headEuler = {
            x: -parsed.x * deg2rad,
            y: -parsed.y * deg2rad,
            z: parsed.z * deg2rad,
          };
        }
        continue;
      }

      if (
        section.startsWith('=rightEye#') ||
        section.startsWith('rightEye#') ||
        section.startsWith('=leftEye#') ||
        section.startsWith('leftEye#')
      ) {
        continue;
      }

      if (section.startsWith('=')) continue;

      const eqIdx = section.lastIndexOf('=');
      const dashIdx = section.lastIndexOf('-');
      const splitIndex = Math.max(eqIdx, dashIdx);
      if (splitIndex > 0 && splitIndex < section.length - 1) {
        const name = section.slice(0, splitIndex).trim();
        const valueStr = section.slice(splitIndex + 1).trim();
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          const value = Number.parseFloat(valueStr);
          if (Number.isFinite(value)) {
            const normalizedName = normalizeIfmBlendShapeName(name);
            const normalizedValue = value / 100;
            blendShapes[normalizedName] = normalizedValue;
            continue;
          }
        }
      }

      if (!headEuler) {
        const parsed = parseTriplet(section);
        if (parsed) {
          headEuler = parsed;
        }
      }
    }
  }

  if (Object.keys(blendShapes).length === 0 && !headEuler) {
    return null;
  }

  return {
    blendShapes,
    headQuat: null,
    headEuler,
    receivedAt: Date.now(),
  };
}

export function normalizeIfmBlendShapeName(name: string): string {
  if (name === 'trackingStatus') return name;
  if (name.endsWith('_L')) return name.slice(0, -2) + 'Left';
  if (name.endsWith('_R')) return name.slice(0, -2) + 'Right';
  return name;
}

function parseTriplet(input: string): { x: number; y: number; z: number } | null {
  const parts = input.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length < 3) return null;
  const x = parts[0];
  const y = parts[1];
  const z = parts[2];
  if (x === undefined || y === undefined || z === undefined) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}
