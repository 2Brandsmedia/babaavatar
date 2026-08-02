import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@renderer/lib/ipc/api';
import { createRecordingChannel } from '@renderer/lib/broadcast/recording-channel';
import { createLogger } from '@renderer/lib/logger';

const log = createLogger('recorder');

const CAPTURE_FPS = 60;
const VIDEO_BITS_PER_SECOND = 25_000_000;

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

export interface RecorderApi {
  recording: boolean;
  error: string | null;
  toggle: () => void;
}

function pickMimeType(): string | null {
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

export function useRecorder(canvasRef: React.RefObject<HTMLCanvasElement>): RecorderApi {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const channelRef = useRef<ReturnType<typeof createRecordingChannel> | null>(null);
  if (channelRef.current === null) channelRef.current = createRecordingChannel();

  const publishState = useCallback((rec: boolean, lastSavedPath: string | null) => {
    channelRef.current?.publish({
      recording: rec,
      startedAt: rec ? Date.now() : null,
      lastSavedPath,
    });
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  }, []);

  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setError('Kein Canvas zum Aufnehmen gefunden.');
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError('MediaRecorder unterstützt kein WebM auf diesem System.');
      return;
    }
    setError(null);

    const stream = canvas.captureStream(CAPTURE_FPS);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    });
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      setError('Aufnahme-Fehler — Aufnahme gestoppt.');
      log.error('MediaRecorder-Fehler');
      recorder.stop();
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      setRecording(false);
      for (const track of stream.getTracks()) track.stop();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      if (blob.size === 0) {
        setError('Aufnahme war leer — nichts gespeichert.');
        publishState(false, null);
        return;
      }
      void blob
        .arrayBuffer()
        .then((buffer) => api.recording.save({ buffer, mimeType }))
        .then((result) => {
          log.info('Aufnahme gespeichert', { filePath: result.filePath, bytes: result.bytes });
          publishState(false, result.filePath);
        })
        .catch((err: unknown) => {
          setError('Speichern fehlgeschlagen.');
          log.error('Aufnahme-Speichern fehlgeschlagen', {
            err: err instanceof Error ? err.message : String(err),
          });
          publishState(false, null);
        });
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
    publishState(true, null);
    log.info('Aufnahme gestartet', { mimeType });
  }, [canvasRef, publishState]);

  const toggle = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  useEffect(() => {
    const unsubscribe = api.on(api.ipcChannels.RECORDING_TOGGLE, () => toggle());
    return () => unsubscribe();
  }, [toggle]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, []);

  return { recording, error, toggle };
}
