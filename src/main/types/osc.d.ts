declare module 'osc' {
  interface UdpPortOptions {
    localAddress: string;
    localPort: number;
    metadata?: boolean;
  }

  interface OscMessage {
    address: string;
    args: unknown[];
  }

  type UdpPortEventMap = {
    message: (msg: OscMessage) => void;
    error: (err: Error) => void;
    ready: () => void;
  };

  export class UDPPort {
    constructor(options: UdpPortOptions);
    open(): void;
    close(): void;
    on<K extends keyof UdpPortEventMap>(event: K, cb: UdpPortEventMap[K]): void;
  }
}
