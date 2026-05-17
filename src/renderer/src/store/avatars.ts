import { create } from 'zustand';
import type { AvatarRecord } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { renderVrmThumbnail } from '@renderer/lib/avatar/thumbnail';
import { createLogger } from '@renderer/lib/logger';

const log = createLogger('avatars-store');

interface AvatarsState {
  avatars: AvatarRecord[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  importFile: (file: File, sourceUrl?: string) => Promise<AvatarRecord>;
  remove: (id: string) => Promise<void>;
  subscribeToAdditions: () => () => void;
}

export const useAvatarsStore = create<AvatarsState>((set, get) => ({
  avatars: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const avatars = await api.avatars.list();
      set({ avatars, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Avatare konnten nicht geladen werden',
        isLoading: false,
      });
    }
  },

  importFile: async (file, sourceUrl) => {
    const buffer = await file.arrayBuffer();
    let thumbnailDataUrl: string | undefined;
    try {
      thumbnailDataUrl = await renderVrmThumbnail(buffer.slice(0));
    } catch (err) {
      log.warn('Thumbnail-Rendering fehlgeschlagen', err);
    }
    const record = await api.avatars.importFile({
      buffer,
      fileName: file.name,
      thumbnailDataUrl,
      sourceUrl,
    });
    set({ avatars: [...get().avatars, record] });
    return record;
  },

  remove: async (id) => {
    await api.avatars.delete(id);
    set({ avatars: get().avatars.filter((a) => a.id !== id) });
  },

  subscribeToAdditions: () => {
    return api.on<AvatarRecord>(api.ipcChannels.AVATAR_ADDED, (record) => {
      const exists = new Set(get().avatars.map((a) => a.id));
      if (exists.has(record.id)) return;
      set({ avatars: [...get().avatars, record] });
    });
  },
}));
