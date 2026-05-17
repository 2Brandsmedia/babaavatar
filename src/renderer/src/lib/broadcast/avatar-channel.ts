import type { AvatarRecord } from '@shared/types';

const CHANNEL_NAME = 'babaavatar-active-avatar';
const REQUEST_CHANNEL_NAME = 'babaavatar-avatar-state-request';

export interface ActiveAvatarMessage {
  avatar: AvatarRecord | null;
  fileUrl: string | null;
  reloadCounter: number;
}

export interface AvatarChannel {
  publish: (message: ActiveAvatarMessage) => void;
  subscribe: (handler: (message: ActiveAvatarMessage) => void) => () => void;
  close: () => void;
}

export function createAvatarChannel(): AvatarChannel {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    publish: (message) => channel.postMessage(message),
    subscribe: (handler) => {
      const listener = (event: MessageEvent<ActiveAvatarMessage>): void => handler(event.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close: () => channel.close(),
  };
}

export interface AvatarRequestChannel {
  onRequest: (handler: () => void) => () => void;
  sendRequest: () => void;
  close: () => void;
}

export function createAvatarRequestChannel(): AvatarRequestChannel {
  const channel = new BroadcastChannel(REQUEST_CHANNEL_NAME);
  return {
    onRequest: (handler) => {
      const listener = (): void => handler();
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    sendRequest: () => channel.postMessage({ type: 'request' }),
    close: () => channel.close(),
  };
}
