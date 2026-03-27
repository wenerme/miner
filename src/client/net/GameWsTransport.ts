import type { GameContext, ProtocolC2S, ProtocolS2C } from '#/common/GameContext';
import { decodeWireMessage, encodeWireMessage, validateC2S } from '#/common/protocol/wire';

export type WsTransportState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class GameWsTransport {
  private ws: WebSocket | null = null;
  private ctx: GameContext;
  private _state: WsTransportState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string = '';
  private c2sUnsubs: Array<() => void> = [];

  get state() { return this._state; }

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  connect(url: string) {
    this.url = url;
    this._state = 'connecting';
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this._state = 'connected';
      this.bindC2SForwarding();
    };

    this.ws.onmessage = (event) => {
      const msg = decodeWireMessage(event.data);
      if (!msg || msg.dir !== 's2c') return;
      const name = msg.name as keyof ProtocolS2C;
      if (name === 's2c:chunk' && msg.payload && typeof msg.payload === 'object') {
        const p = msg.payload as { cx: number; cz: number; blocks: number[] };
        this.ctx.s2c.emit(name, {
          cx: p.cx,
          cz: p.cz,
          blocks: new Uint8Array(p.blocks),
        } as ProtocolS2C[typeof name]);
      } else {
        this.ctx.s2c.emit(name, msg.payload as ProtocolS2C[typeof name]);
      }
    };

    this.ws.onclose = () => {
      this._state = 'disconnected';
      this.unbindC2S();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this._state = 'error';
    };
  }

  private bindC2SForwarding() {
    this.unbindC2S();
    const bus = this.ctx.c2s;
    const events = [
      'c2s:requestChunks', 'c2s:attackEntity', 'c2s:breakBlock', 'c2s:startBreak', 'c2s:cancelBreak',
      'c2s:interactBlock', 'c2s:placeBlock', 'c2s:interactEntity',
      'c2s:craft', 'c2s:chat', 'c2s:command', 'c2s:swapOffhand',
      'c2s:inventoryClick', 'c2s:inventoryCollect', 'c2s:inventoryClose',
      'c2s:useItem',
      'c2s:furnaceClick', 'c2s:furnaceClose',
      'c2s:chestClick', 'c2s:chestClose',
    ] as const satisfies ReadonlyArray<keyof ProtocolC2S & string>;
    for (const name of events) {
      const unsub = bus.on(name, (payload: unknown) => {
        this.sendC2S(name, payload);
      });
      this.c2sUnsubs.push(unsub);
    }
  }

  private unbindC2S() {
    for (const unsub of this.c2sUnsubs) unsub();
    this.c2sUnsubs = [];
  }

  sendC2S(name: string, payload: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(encodeWireMessage('c2s', name, payload));
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this._state === 'disconnected' && this.url) {
        this.connect(this.url);
      }
    }, 3000);
  }

  disconnect() {
    this.unbindC2S();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this._state = 'disconnected';
  }
}
