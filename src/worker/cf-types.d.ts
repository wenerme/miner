/**
 * Cloudflare Workers runtime type declarations.
 * These types are provided by the Workers runtime and are not available in standard TS DOM lib.
 */

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  props: Record<string, unknown>;
}

interface WebSocket {
  accept(): void;
}

interface ResponseInit {
  webSocket?: WebSocket;
}
