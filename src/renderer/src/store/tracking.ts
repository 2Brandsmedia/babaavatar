import { create } from 'zustand';
import type { GestureName, GestureState, PoseFrame } from '@shared/types';
import type { TrackingMetrics } from '@renderer/lib/tracking/use-tracking';

export interface RawLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface RawLandmarks {
  face: RawLandmark[] | null;
  pose: RawLandmark[] | null;
  hands: Array<{ landmarks: RawLandmark[]; side: 'Left' | 'Right' }>;
}

const DEFAULT_METRICS: TrackingMetrics = {
  fps: 0,
  averageLatencyMs: 0,
  framesProcessed: 0,
  droppedFrames: 0,
};

export type ReloadTrigger = number;

interface TrackingState {
  cameraId: string | null;
  microphoneId: string | null;
  trackingEnabled: boolean;
  lipsyncEnabled: boolean;
  videoStream: MediaStream | null;
  pose: PoseFrame | null;
  rawLandmarksRef: { current: RawLandmarks | null };
  metrics: TrackingMetrics;
  trackingReady: boolean;
  trackingError: string | null;
  lipsyncReady: boolean;
  lipsyncError: string | null;
  micLevel: number;
  micGateOpen: boolean;
  gestureLiveRef: { current: Map<GestureName, GestureState> };
  gestureLastTrigger: { name: GestureName; at: number } | null;
  reloadCounter: ReloadTrigger;
  isReloading: boolean;
  triggerReload: () => void;
  setCameraId: (id: string | null) => void;
  setMicrophoneId: (id: string | null) => void;
  setTrackingEnabled: (enabled: boolean) => void;
  setLipsyncEnabled: (enabled: boolean) => void;
  setVideoStream: (stream: MediaStream | null) => void;
  setPose: (pose: PoseFrame | null) => void;
  setRawLandmarks: (landmarks: RawLandmarks | null) => void;
  setMetrics: (metrics: TrackingMetrics) => void;
  setTrackingState: (ready: boolean, error: string | null) => void;
  setLipsyncState: (ready: boolean, error: string | null) => void;
  setMicLevel: (level: number, gateOpen: boolean) => void;
  setGestureLive: (gestures: GestureState[]) => void;
  setGestureLastTrigger: (name: GestureName) => void;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  cameraId: null,
  microphoneId: null,
  trackingEnabled: true,
  lipsyncEnabled: true,
  videoStream: null,
  pose: null,
  rawLandmarksRef: { current: null },
  metrics: DEFAULT_METRICS,
  trackingReady: false,
  trackingError: null,
  lipsyncReady: false,
  lipsyncError: null,
  micLevel: 0,
  micGateOpen: false,
  gestureLiveRef: { current: new Map() },
  gestureLastTrigger: null,
  reloadCounter: 0,
  isReloading: false,
  triggerReload: () => {
    set({ isReloading: true });
    window.setTimeout(() => {
      set((state) => ({ reloadCounter: state.reloadCounter + 1, isReloading: false }));
    }, 250);
  },
  setCameraId: (id) => set({ cameraId: id }),
  setMicrophoneId: (id) => set({ microphoneId: id }),
  setTrackingEnabled: (enabled) => set({ trackingEnabled: enabled }),
  setLipsyncEnabled: (enabled) => set({ lipsyncEnabled: enabled }),
  setVideoStream: (stream) => set({ videoStream: stream }),
  setPose: (pose) => set({ pose }),
  setRawLandmarks: (landmarks) => {
    get().rawLandmarksRef.current = landmarks;
  },
  setMetrics: (metrics) => set({ metrics }),
  setTrackingState: (ready, error) => set({ trackingReady: ready, trackingError: error }),
  setLipsyncState: (ready, error) => set({ lipsyncReady: ready, lipsyncError: error }),
  setMicLevel: (level, gateOpen) => set({ micLevel: level, micGateOpen: gateOpen }),
  setGestureLive: (gestures) => {
    const map = get().gestureLiveRef.current;
    map.clear();
    for (const g of gestures) map.set(g.name, g);
  },
  setGestureLastTrigger: (name) => set({ gestureLastTrigger: { name, at: Date.now() } }),
}));
