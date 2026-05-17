import type { PoseFrame } from '@shared/types';

const CHANNEL_NAME = 'babaavatar-pose';

export interface PoseChannel {
  publish: (frame: PoseFrame) => void;
  subscribe: (handler: (frame: PoseFrame) => void) => () => void;
  close: () => void;
}

export function createPoseChannel(): PoseChannel {
  const channel = new BroadcastChannel(CHANNEL_NAME);

  return {
    publish: (frame) => channel.postMessage(frame),
    subscribe: (handler) => {
      const listener = (event: MessageEvent<PoseFrame>): void => handler(event.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close: () => channel.close(),
  };
}
