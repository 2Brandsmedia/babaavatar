import { globalShortcut } from 'electron';
import type { ExpressionHotkey } from '../shared/types.js';
import { createLogger } from './logger.js';

const log = createLogger('hotkeys');

type TriggerFn = (hotkey: ExpressionHotkey) => void;

const registered = new Map<string, ExpressionHotkey>();
let trigger: TriggerFn = () => undefined;

export function setHotkeyTrigger(fn: TriggerFn): void {
  trigger = fn;
}

export function registerHotkey(hotkey: ExpressionHotkey): boolean {
  unregisterHotkey(hotkey.id);
  const success = globalShortcut.register(hotkey.accelerator, () => trigger(hotkey));
  if (!success) {
    log.warn('globalShortcut konnte nicht registriert werden', { accelerator: hotkey.accelerator });
    return false;
  }
  registered.set(hotkey.id, hotkey);
  log.info('Hotkey registriert', { id: hotkey.id, accelerator: hotkey.accelerator });
  return true;
}

export function unregisterHotkey(id: string): void {
  const existing = registered.get(id);
  if (!existing) return;
  globalShortcut.unregister(existing.accelerator);
  registered.delete(id);
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll();
  registered.clear();
}
