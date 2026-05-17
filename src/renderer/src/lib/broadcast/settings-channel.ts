import type { AppSettings } from '@shared/types';

const CHANNEL_NAME = 'babaavatar-settings';
const REQUEST_CHANNEL_NAME = 'babaavatar-settings-request';

export interface SettingsChannel {
  publish: (settings: AppSettings) => void;
  subscribe: (handler: (settings: AppSettings) => void) => () => void;
  sendRequest: () => void;
  onRequest: (handler: () => void) => () => void;
  close: () => void;
}

export function createSettingsChannel(): SettingsChannel {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const requestChannel = new BroadcastChannel(REQUEST_CHANNEL_NAME);
  return {
    publish: (settings) => channel.postMessage(settings),
    subscribe: (handler) => {
      const listener = (event: MessageEvent<AppSettings>): void => handler(event.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    sendRequest: () => requestChannel.postMessage({ type: 'request' }),
    onRequest: (handler) => {
      const listener = (): void => handler();
      requestChannel.addEventListener('message', listener);
      return () => requestChannel.removeEventListener('message', listener);
    },
    close: () => {
      channel.close();
      requestChannel.close();
    },
  };
}
