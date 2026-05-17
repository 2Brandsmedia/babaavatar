import { useRef, useState, type RefObject } from 'react';
import type React from 'react';
import type { AppSettings } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import { clamp } from './avatar-camera-control';

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
}

export interface AvatarCameraInputHandlers {
  hintVisible: boolean;
  setHintVisible: (v: boolean) => void;
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onDoubleClick: () => void;
}

export function useAvatarCameraInput(
  settingsRef: RefObject<AppSettings | null>,
): AvatarCameraInputHandlers {
  const [hintVisible, setHintVisibleState] = useState(true);
  const dragRef = useRef<DragState | null>(null);

  const setHintVisible = (v: boolean): void => {
    setHintVisibleState(v);
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    const s = settingsRef.current;
    if (!s) return;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const next = clamp(s.cameraZoom + delta, 0.5, 3.0);
    (settingsRef as { current: AppSettings | null }).current = { ...s, cameraZoom: next };
    void api.settings.set('cameraZoom', next).catch(() => undefined);
    setHintVisible(false);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (e.button !== 0) return;
    const s = settingsRef.current;
    if (!s) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: s.cameraOffsetX,
      startOffsetY: s.cameraOffsetY,
    };
    setHintVisible(false);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const d = dragRef.current;
    const s = settingsRef.current;
    if (!d?.active || !s) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const dx = ((e.clientX - d.startX) / w) * 2;
    const dy = ((e.clientY - d.startY) / h) * -2;
    const nextX = clamp(d.startOffsetX + dx, -1, 1);
    const nextY = clamp(d.startOffsetY + dy, -1, 1);
    (settingsRef as { current: AppSettings | null }).current = {
      ...s,
      cameraOffsetX: nextX,
      cameraOffsetY: nextY,
    };
  };

  const onMouseUp = (): void => {
    const d = dragRef.current;
    const s = settingsRef.current;
    if (d?.active && s) {
      void api.settings.set('cameraOffsetX', s.cameraOffsetX).catch(() => undefined);
      void api.settings.set('cameraOffsetY', s.cameraOffsetY).catch(() => undefined);
    }
    dragRef.current = null;
  };

  const onDoubleClick = (): void => {
    const s = settingsRef.current;
    if (s) {
      (settingsRef as { current: AppSettings | null }).current = {
        ...s,
        cameraZoom: 1,
        cameraOffsetX: 0,
        cameraOffsetY: 0,
      };
    }
    void api.settings.set('cameraZoom', 1).catch(() => undefined);
    void api.settings.set('cameraOffsetX', 0).catch(() => undefined);
    void api.settings.set('cameraOffsetY', 0).catch(() => undefined);
    setHintVisible(true);
    window.setTimeout(() => setHintVisible(false), 2500);
  };

  return { hintVisible, setHintVisible, onWheel, onMouseDown, onMouseMove, onMouseUp, onDoubleClick };
}
