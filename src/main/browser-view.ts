import { WebContentsView, BaseWindow } from 'electron';
import { createLogger } from './logger.js';

const log = createLogger('browser-view');

interface BrowserHostContext {
  parentWindow: BaseWindow;
}

let view: WebContentsView | null = null;
let host: BrowserHostContext | null = null;

export function setBrowserHost(context: BrowserHostContext): void {
  host = context;
}

function ensureView(): WebContentsView {
  if (view && !view.webContents.isDestroyed()) return view;
  view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  view.setBackgroundColor('#1c1c22');
  log.info('BrowserView erstellt');
  return view;
}

export function navigateBrowser(url: string): void {
  const next = ensureView();
  if (!host) {
    log.warn('Kein Host-Window registriert');
    return;
  }
  next.webContents.loadURL(url).catch((err: unknown) => {
    log.error('Navigation fehlgeschlagen', err, { url });
  });
}

export function showBrowser(bounds: { x: number; y: number; width: number; height: number }): void {
  if (!host) return;
  const next = ensureView();
  if (!host.parentWindow.contentView.children.includes(next)) {
    host.parentWindow.contentView.addChildView(next);
  }
  next.setBounds(bounds);
  next.setVisible(true);
}

export function hideBrowser(): void {
  if (!view) return;
  view.setVisible(false);
}

export function setBrowserBounds(bounds: { x: number; y: number; width: number; height: number }): void {
  if (!view) return;
  view.setBounds(bounds);
}

export function browserBack(): void {
  if (view?.webContents.navigationHistory.canGoBack()) {
    view.webContents.navigationHistory.goBack();
  }
}

export function browserForward(): void {
  if (view?.webContents.navigationHistory.canGoForward()) {
    view.webContents.navigationHistory.goForward();
  }
}

export function browserReload(): void {
  view?.webContents.reload();
}
