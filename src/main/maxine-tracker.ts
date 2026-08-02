import { spawn, execFile, type ChildProcess } from 'node:child_process';
import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import { MAXINE_UDP_PORT, MAXINE_CMD_PORT_BASE } from '../shared/constants.js';
import type { MaxineCamera, MaxineStatus, VmcSnapshot } from '../shared/types.js';
import { createLogger } from './logger.js';

const log = createLogger('maxine-tracker');

const BROADCAST_INTERVAL_MS = 1000 / 60;
const CAPS_TIMEOUT_MS = 15000;

// ExpressionApp liefert 53 Koeffizienten (0..1) in fester Reihenfolge.
// Namen im iFacialMocap-Stil (_L/_R), damit dieselbe Normalisierung greift wie beim iPhone-Pfad.
const EXP_INDEX_TO_ARKIT = [
  'browDown_L',
  'browDown_R',
  'browInnerUp', // Index 2: browInnerUp_L — wird mit 3 gemittelt
  'browInnerUp', // Index 3: browInnerUp_R
  'browOuterUp_L',
  'browOuterUp_R',
  'cheekPuff', // Index 6: cheekPuff_L — wird mit 7 gemittelt
  'cheekPuff', // Index 7: cheekPuff_R
  'cheekSquint_L',
  'cheekSquint_R',
  'eyeBlink_L',
  'eyeBlink_R',
  'eyeLookDown_L',
  'eyeLookDown_R',
  'eyeLookIn_L',
  'eyeLookIn_R',
  'eyeLookOut_L',
  'eyeLookOut_R',
  'eyeLookUp_L',
  'eyeLookUp_R',
  'eyeSquint_L',
  'eyeSquint_R',
  'eyeWide_L',
  'eyeWide_R',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimple_L',
  'mouthDimple_R',
  'mouthFrown_L',
  'mouthFrown_R',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDown_L',
  'mouthLowerDown_R',
  'mouthPress_L',
  'mouthPress_R',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmile_L',
  'mouthSmile_R',
  'mouthStretch_L',
  'mouthStretch_R',
  'mouthUpperUp_L',
  'mouthUpperUp_R',
  'noseSneer_L',
  'noseSneer_R',
] as const;

interface MaxineConfig {
  exePath: string;
  cameraIndex: number;
  cameraCap: number;
  camRes: string;
  camFps: number;
}

interface MaxineHandle {
  child: ChildProcess;
  socket: dgram.Socket;
  cameraIndex: number;
  stop: () => void;
}

let current: MaxineHandle | null = null;
let controlWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;
let lastMessageAt = 0;
let lastBroadcastAt = 0;
let packetsReceived = 0;
let parseFailures = 0;
let lastError: string | null = null;
let calibrationCache: number[] = [];

export function setMaxineWindows(windows: {
  controlWindow: BrowserWindow;
  outputWindow: BrowserWindow;
}): void {
  controlWindow = windows.controlWindow;
  outputWindow = windows.outputWindow;
}

export function isMaxineAvailable(): boolean {
  return process.platform === 'win32';
}

export function getMaxineStatus(): MaxineStatus {
  return {
    available: isMaxineAvailable(),
    running: current !== null,
    pid: current?.child.pid ?? null,
    packetsReceived,
    lastMessageAt,
    error: lastError,
  };
}

export function validateExePath(exePath: string | null): string | null {
  if (!exePath) return 'Kein Pfad zur ExpressionApp.exe gesetzt.';
  if (!fs.existsSync(exePath)) return `Datei nicht gefunden: ${exePath}`;
  if (path.basename(exePath).toLowerCase() !== 'expressionapp.exe') {
    return 'Der Pfad muss auf ExpressionApp.exe zeigen.';
  }
  return null;
}

export async function listMaxineCameras(exePath: string): Promise<MaxineCamera[]> {
  if (!isMaxineAvailable()) {
    throw new Error('NVIDIA Maxine ist nur unter Windows verfügbar.');
  }
  const pathError = validateExePath(exePath);
  if (pathError) throw new Error(pathError);

  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      exePath,
      ['--print_caps'],
      { timeout: CAPS_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (err, out) => {
        if (err && !out) {
          reject(new Error(`ExpressionApp --print_caps fehlgeschlagen: ${err.message}`));
          return;
        }
        resolve(out);
      },
    );
  });

  // ExpressionApp trennt Log-Ausgabe und JSON-Block durch Leerzeilen.
  const jsonStart = stdout.indexOf('[');
  if (jsonStart < 0) throw new Error('Keine Kamera-Liste in der ExpressionApp-Ausgabe gefunden.');
  const parsed: unknown = JSON.parse(stdout.slice(jsonStart));
  if (!Array.isArray(parsed)) throw new Error('Kamera-Liste hat ein unerwartetes Format.');

  const cameras: MaxineCamera[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (typeof entry !== 'object' || entry === null) continue;
    const cam = entry as { id?: number; name?: string; caps?: unknown[] };
    const modes = Array.isArray(cam.caps)
      ? cam.caps.flatMap((rawCap) => {
          if (typeof rawCap !== 'object' || rawCap === null) return [];
          const cap = rawCap as {
            id?: number;
            maxCX?: number;
            maxCY?: number;
            minInterval?: number;
            format?: number;
          };
          if (
            typeof cap.id !== 'number' ||
            typeof cap.maxCX !== 'number' ||
            typeof cap.maxCY !== 'number' ||
            typeof cap.minInterval !== 'number' ||
            cap.minInterval <= 0
          ) {
            return [];
          }
          return [
            {
              id: cap.id,
              width: cap.maxCX,
              height: cap.maxCY,
              fps: Math.round((1 / cap.minInterval) * 10_000_000),
              format: typeof cap.format === 'number' ? cap.format : 0,
            },
          ];
        })
      : [];
    cameras.push({
      id: typeof cam.id === 'number' ? cam.id : index,
      name: typeof cam.name === 'string' ? cam.name : `Kamera ${index}`,
      modes,
    });
  }
  return cameras;
}

export async function startMaxine(config: MaxineConfig): Promise<MaxineStatus> {
  if (!isMaxineAvailable()) {
    lastError = 'NVIDIA Maxine ist nur unter Windows verfügbar.';
    return getMaxineStatus();
  }
  const pathError = validateExePath(config.exePath);
  if (pathError) {
    lastError = pathError;
    return getMaxineStatus();
  }

  await stopMaxine();
  lastError = null;

  const modelPath = path.join(path.dirname(config.exePath), 'models');
  const args = [
    '--show=False',
    '--landmarks=True',
    `--model_path=${modelPath}`,
    `--cam_res=${config.camRes}`,
    '--expr_mode=2',
    `--camera=${config.cameraIndex}`,
    `--camera_cap=${config.cameraCap}`,
    `--cam_fps=${config.camFps}`,
    `--fps_limit=${config.camFps}`,
    '--use_opencl=False',
    '--cam_api=0',
  ];
  if (calibrationCache.length > 0) {
    args.push(`--expr_calibration=${calibrationCache.map((x) => x.toFixed(6)).join(';')}`);
  }

  const socket = dgram.createSocket('udp4');
  socket.on('error', (err) => {
    lastError = `UDP-Fehler: ${err.message}`;
    log.error('Maxine-UDP-Socket Fehler', err);
  });
  socket.on('message', (msg) => {
    handleDatagram(msg);
  });
  socket.bind(MAXINE_UDP_PORT, '127.0.0.1');

  log.info('Starte ExpressionApp', { exePath: config.exePath, camera: config.cameraIndex });
  const child = spawn(config.exePath, args, {
    stdio: 'ignore',
    windowsHide: true,
  });

  child.on('error', (err) => {
    lastError = `ExpressionApp-Start fehlgeschlagen: ${err.message}`;
    log.error('ExpressionApp-Spawn-Fehler', err);
    void stopMaxine();
  });
  child.on('exit', (code) => {
    if (current?.child === child) {
      if (code !== 0 && code !== null) {
        lastError = `ExpressionApp wurde beendet (Exit-Code ${code}).`;
      }
      log.info('ExpressionApp beendet', { code });
      void stopMaxine();
    }
  });

  current = {
    child,
    socket,
    cameraIndex: config.cameraIndex,
    stop: () => {
      try {
        socket.close();
      } catch (err) {
        log.warn('Maxine-Socket-Close-Fehler', { err: String(err) });
      }
      if (!child.killed) {
        try {
          child.kill();
        } catch (err) {
          log.warn('ExpressionApp-Kill-Fehler', { err: String(err) });
        }
      }
    },
  };
  return getMaxineStatus();
}

export async function stopMaxine(): Promise<void> {
  if (!current) return;
  const handle = current;
  current = null;
  handle.stop();
  packetsReceived = 0;
  parseFailures = 0;
  lastBroadcastAt = 0;
}

export async function calibrateMaxine(): Promise<boolean> {
  if (!current) return false;
  const port = MAXINE_CMD_PORT_BASE + current.cameraIndex;
  const payload = Buffer.from('{"cmd":" calibrate"}', 'utf-8');
  return await new Promise<boolean>((resolve) => {
    const sender = dgram.createSocket('udp4');
    sender.send(payload, port, '127.0.0.1', (err) => {
      sender.close();
      if (err) {
        log.warn('Kalibrier-Kommando fehlgeschlagen', { err: err.message });
        resolve(false);
        return;
      }
      log.info('Kalibrier-Kommando gesendet', { port });
      resolve(true);
    });
  });
}

function handleDatagram(msg: Buffer): void {
  packetsReceived += 1;
  lastMessageAt = Date.now();

  let data: unknown;
  try {
    // ExpressionApp terminiert Datagramme mit einem Null-Byte.
    const text = msg.toString('utf-8').replace(/\0+$/, '');
    data = JSON.parse(text);
  } catch {
    parseFailures += 1;
    if (parseFailures <= 3) {
      log.warn('Maxine-Datagramm nicht parsebar', { bytes: msg.length });
    }
    return;
  }

  if (typeof data !== 'object' || data === null) return;
  const frame = data as { cal?: unknown[]; cnf?: number; rot?: unknown[]; exp?: unknown[] };

  if (Array.isArray(frame.cal) && frame.cal.length > 0) {
    calibrationCache = frame.cal.filter((x): x is number => typeof x === 'number');
    log.info('Maxine-Kalibrierung empfangen', { coefficients: calibrationCache.length });
    return;
  }

  if (!Array.isArray(frame.exp)) return;

  const blendShapes: Record<string, number> = {};
  for (const [i, name] of EXP_INDEX_TO_ARKIT.entries()) {
    if (i === 2 || i === 3 || i === 6 || i === 7) continue;
    const value = frame.exp[i];
    if (typeof value === 'number' && Number.isFinite(value)) {
      blendShapes[normalizeSideSuffix(name)] = clamp01(value);
    }
  }
  const browL = numberAt(frame.exp, 2);
  const browR = numberAt(frame.exp, 3);
  if (browL !== null && browR !== null) blendShapes['browInnerUp'] = clamp01((browL + browR) / 2);
  const cheekL = numberAt(frame.exp, 6);
  const cheekR = numberAt(frame.exp, 7);
  if (cheekL !== null && cheekR !== null) blendShapes['cheekPuff'] = clamp01((cheekL + cheekR) / 2);

  let headQuat: { x: number; y: number; z: number; w: number } | null = null;
  if (Array.isArray(frame.rot) && frame.rot.length >= 4) {
    const [qx, qy, qz, qw] = frame.rot;
    if (
      typeof qx === 'number' &&
      typeof qy === 'number' &&
      typeof qz === 'number' &&
      typeof qw === 'number'
    ) {
      headQuat = { x: qx, y: qy, z: qz, w: qw };
    }
  }

  const now = Date.now();
  if (now - lastBroadcastAt < BROADCAST_INTERVAL_MS) return;
  lastBroadcastAt = now;

  const snapshot: VmcSnapshot = {
    blendShapes,
    headQuat,
    headEuler: null,
    receivedAt: now,
  };
  outputWindow?.webContents.send(IPC.VMC_FRAME, snapshot);
  controlWindow?.webContents.send(IPC.VMC_FRAME, snapshot);
}

function normalizeSideSuffix(name: string): string {
  if (name.endsWith('_L')) return name.slice(0, -2) + 'Left';
  if (name.endsWith('_R')) return name.slice(0, -2) + 'Right';
  return name;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function numberAt(arr: unknown[], index: number): number | null {
  const value = arr[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
