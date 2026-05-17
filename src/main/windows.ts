import { BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CONTROL_WINDOW,
  DEFAULT_OUTPUT_WINDOW,
  DEFAULT_CHROMA_COLOR,
} from '../shared/constants.js';
import * as settings from './settings.js';
import { createLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRELOAD = path.join(__dirname, '../preload/index.mjs');

const isDev = !!process.env['ELECTRON_RENDERER_URL'];
const log = createLogger('windows');

interface WindowRefs {
  controlWindow: BrowserWindow | null;
  outputWindow: BrowserWindow | null;
}

let refs: WindowRefs = { controlWindow: null, outputWindow: null };

export function setWindowRefs(next: WindowRefs): void {
  refs = next;
}

export function getControlWindow(): BrowserWindow | null {
  return refs.controlWindow;
}

export function getOutputWindow(): BrowserWindow | null {
  return refs.outputWindow;
}

export function createControlWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: DEFAULT_CONTROL_WINDOW.width,
    height: DEFAULT_CONTROL_WINDOW.height,
    minWidth: DEFAULT_CONTROL_WINDOW.minWidth,
    minHeight: DEFAULT_CONTROL_WINDOW.minHeight,
    title: 'BabaAvatar – Steuerung',
    backgroundColor: '#0f0f12',
    show: false,
    webPreferences: {
      preload: PRELOAD,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  attachRendererDiagnostics(window, 'control');

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL']);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  log.info('Control-Window erstellt');
  return window;
}

function attachRendererDiagnostics(window: BrowserWindow, label: string): void {
  window.webContents.on('console-message', (_event, level, message, line, source) => {
    log.info(`[renderer:${label}] console`, { level, message, line, source });
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    log.error(`[renderer:${label}] did-fail-load`, undefined, { errorCode, errorDescription, url });
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    log.error(`[renderer:${label}] render-process-gone`, undefined, {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });
}

export function createOutputWindow(): BrowserWindow {
  const initialAlwaysOnTop = settings.get('outputAlwaysOnTop');
  const initialChroma = settings.get('chromaColor') || DEFAULT_CHROMA_COLOR;

  const window = new BrowserWindow({
    width: DEFAULT_OUTPUT_WINDOW.width,
    height: DEFAULT_OUTPUT_WINDOW.height,
    minWidth: DEFAULT_OUTPUT_WINDOW.minWidth,
    minHeight: DEFAULT_OUTPUT_WINDOW.minHeight,
    title: 'BabaAvatar – Output',
    backgroundColor: initialChroma,
    frame: false,
    alwaysOnTop: initialAlwaysOnTop,
    show: false,
    webPreferences: {
      preload: PRELOAD,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on('ready-to-show', () => window.show());
  attachRendererDiagnostics(window, 'output');

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/output.html`);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, '../renderer/output.html'));
  }

  log.info('Output-Window erstellt', { alwaysOnTop: initialAlwaysOnTop });
  return window;
}

export function toggleOutputAlwaysOnTop(value: boolean): void {
  refs.outputWindow?.setAlwaysOnTop(value);
  settings.set('outputAlwaysOnTop', value);
  log.info('Output Always-on-Top umgeschaltet', { value });
}

export function openOutputWindow(): void {
  if (!refs.outputWindow || refs.outputWindow.isDestroyed()) {
    const next = createOutputWindow();
    refs = { ...refs, outputWindow: next };
    return;
  }
  refs.outputWindow.show();
}

export function closeOutputWindow(): void {
  refs.outputWindow?.hide();
}
