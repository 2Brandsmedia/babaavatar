import { create } from 'zustand';

export type UpdaterPhase = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

export interface UpdaterProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

interface UpdaterState {
  phase: UpdaterPhase;
  version: string | null;
  currentVersion: string | null;
  releaseNotes: string | null;
  progress: UpdaterProgress | null;
  errorMessage: string | null;
  setAvailable: (payload: {
    version: string;
    currentVersion: string;
    releaseNotes: string | null;
  }) => void;
  setDownloading: () => void;
  setProgress: (progress: UpdaterProgress) => void;
  setDownloaded: (version: string) => void;
  setError: (message: string) => void;
  dismiss: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  phase: 'idle',
  version: null,
  currentVersion: null,
  releaseNotes: null,
  progress: null,
  errorMessage: null,
  setAvailable: (payload) =>
    set({
      phase: 'available',
      version: payload.version,
      currentVersion: payload.currentVersion,
      releaseNotes: payload.releaseNotes,
      progress: null,
      errorMessage: null,
    }),
  setDownloading: () => set({ phase: 'downloading', progress: null, errorMessage: null }),
  setProgress: (progress) => set({ progress }),
  setDownloaded: (version) =>
    set({ phase: 'downloaded', version, progress: null, errorMessage: null }),
  setError: (message) => set({ phase: 'error', errorMessage: message }),
  dismiss: () => set({ phase: 'idle', progress: null }),
}));
