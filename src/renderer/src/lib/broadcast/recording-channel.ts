const CHANNEL_NAME = 'babaavatar-recording';

export interface RecordingState {
  recording: boolean;
  startedAt: number | null;
  lastSavedPath: string | null;
}

interface RecordingChannel {
  publish: (state: RecordingState) => void;
  subscribe: (callback: (state: RecordingState) => void) => () => void;
  close: () => void;
}

export function createRecordingChannel(): RecordingChannel {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    publish: (state) => channel.postMessage(state),
    subscribe: (callback) => {
      const listener = (event: MessageEvent<RecordingState>): void => callback(event.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close: () => channel.close(),
  };
}
