import { create } from 'zustand';
import type { AppSettings } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { createSettingsChannel } from '@renderer/lib/broadcast/settings-channel';

const broadcastChannel = createSettingsChannel();

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  broadcastChannel.onRequest(() => {
    const current = get().settings;
    if (current) broadcastChannel.publish(current);
  });

  return {
    settings: null,
    isLoading: false,
    error: null,

    load: async () => {
      set({ isLoading: true, error: null });
      try {
        const settings = await api.settings.getAll();
        set({ settings, isLoading: false });
        broadcastChannel.publish(settings);
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Settings konnten nicht geladen werden',
          isLoading: false,
        });
      }
    },

    update: async (key, value) => {
      const previous = get().settings;
      if (previous) {
        const optimistic = { ...previous, [key]: value };
        set({ settings: optimistic });
        broadcastChannel.publish(optimistic);
      }
      try {
        const next = await api.settings.set(key, value);
        set({ settings: next });
        broadcastChannel.publish(next);
      } catch (err) {
        if (previous) {
          set({ settings: previous });
          broadcastChannel.publish(previous);
        }
        set({ error: err instanceof Error ? err.message : 'Speichern fehlgeschlagen' });
        throw err;
      }
    },
  };
});
