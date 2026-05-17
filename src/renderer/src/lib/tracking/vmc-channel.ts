import type { VmcSnapshot } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';

export function subscribeVmcFrames(callback: (snapshot: VmcSnapshot) => void): () => void {
  return api.on<VmcSnapshot>(api.ipcChannels.VMC_FRAME, callback);
}
