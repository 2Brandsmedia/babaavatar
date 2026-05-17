const CHANNEL_NAME = 'babaavatar-reload';

export interface ReloadChannel {
  publish: () => void;
  subscribe: (handler: () => void) => () => void;
  close: () => void;
}

export function createReloadChannel(): ReloadChannel {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    publish: () => channel.postMessage({ type: 'reload' }),
    subscribe: (handler) => {
      const listener = (): void => handler();
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close: () => channel.close(),
  };
}
