import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels.js';
import type { VmcSnapshot } from '../shared/types.js';
import { createLogger } from './logger.js';

const log = createLogger('vmc-server');

interface UdpPortEvents {
  message: (msg: { address: string; args: unknown[] }) => void;
  error: (err: Error) => void;
  ready: () => void;
}

interface UdpPort {
  open(): void;
  close(): void;
  on<K extends keyof UdpPortEvents>(event: K, cb: UdpPortEvents[K]): void;
}

interface OscModule {
  UDPPort: new (options: {
    localAddress: string;
    localPort: number;
    metadata?: boolean;
  }) => UdpPort;
}

interface VmcServerHandle {
  stop: () => void;
  port: number;
}

let current: VmcServerHandle | null = null;
let outputWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
const pendingBlend: Record<string, number> = {};
let pendingHead: { x: number; y: number; z: number; w: number } | null = null;
let lastBroadcast = 0;
const BROADCAST_INTERVAL_MS = 1000 / 60;
let lastMessageAt = 0;

export function setVmcWindows(windows: { controlWindow: BrowserWindow; outputWindow: BrowserWindow }): void {
  controlWindow = windows.controlWindow;
  outputWindow = windows.outputWindow;
}

export function isVmcRunning(): boolean {
  return current !== null;
}

export function getVmcStatus(): { running: boolean; port: number | null; lastMessageAt: number } {
  return {
    running: current !== null,
    port: current?.port ?? null,
    lastMessageAt,
  };
}

export async function startVmcServer(port: number): Promise<void> {
  await stopVmcServer();
  const mod = (await import('osc')) as unknown as { default?: OscModule } & OscModule;
  const osc: OscModule = (mod.default ?? mod) as OscModule;

  const udpPort = new osc.UDPPort({
    localAddress: '0.0.0.0',
    localPort: port,
    metadata: false,
  });

  udpPort.on('ready', () => {
    log.info('VMC-Server bereit', { port });
  });

  udpPort.on('error', (err) => {
    log.error('VMC-Server Fehler', err);
  });

  udpPort.on('message', (msg) => {
    handleOscMessage(msg);
  });

  udpPort.open();

  current = {
    port,
    stop: () => {
      try {
        udpPort.close();
      } catch (err) {
        log.warn('VMC-Server konnte nicht sauber geschlossen werden', { err: String(err) });
      }
    },
  };
}

export async function stopVmcServer(): Promise<void> {
  if (!current) return;
  current.stop();
  current = null;
  for (const key of Object.keys(pendingBlend)) delete pendingBlend[key];
  pendingHead = null;
}

function handleOscMessage(msg: { address: string; args: unknown[] }): void {
  lastMessageAt = Date.now();
  const address = msg.address;

  if (address === '/VMC/Ext/Blend/Val') {
    const name = msg.args[0];
    const value = msg.args[1];
    if (typeof name === 'string' && typeof value === 'number') {
      pendingBlend[name] = value;
    }
    return;
  }

  if (address === '/VMC/Ext/Blend/Apply') {
    flushSnapshot();
    return;
  }

  if (address === '/VMC/Ext/Bone/Pos') {
    const boneName = msg.args[0];
    if (boneName !== 'Head') return;
    const qx = msg.args[4];
    const qy = msg.args[5];
    const qz = msg.args[6];
    const qw = msg.args[7];
    if (
      typeof qx === 'number' &&
      typeof qy === 'number' &&
      typeof qz === 'number' &&
      typeof qw === 'number'
    ) {
      pendingHead = { x: qx, y: qy, z: qz, w: qw };
    }
    return;
  }
}

function flushSnapshot(): void {
  const now = Date.now();
  if (now - lastBroadcast < BROADCAST_INTERVAL_MS) return;
  lastBroadcast = now;
  const snapshot: VmcSnapshot = {
    blendShapes: { ...pendingBlend },
    headQuat: pendingHead ? { ...pendingHead } : null,
    receivedAt: now,
  };
  outputWindow?.webContents.send(IPC.VMC_FRAME, snapshot);
  controlWindow?.webContents.send(IPC.VMC_FRAME, snapshot);
}
