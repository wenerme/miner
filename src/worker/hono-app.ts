import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { decodeWireMessage, encodeWireMessage, validateC2S } from '#/common/protocol/wire';

type Env = {
  Bindings: {
    ASSETS: { fetch: typeof fetch };
  };
};

const app = new Hono<Env>();

app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

/**
 * WebSocket endpoint for multiplayer game sessions.
 * Uses Cloudflare Workers native WebSocket API.
 * 
 * For true multiplayer, this will be upgraded to use Durable Objects
 * where each room holds a GameServer instance shared across connections.
 */
app.get('/mine/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  (server as WebSocket).accept();

  (server as WebSocket).addEventListener('message', (event) => {
    const msg = decodeWireMessage(event.data as string);
    if (!msg || msg.dir !== 'c2s') return;

    const validation = validateC2S(msg.name, msg.payload);
    if (!validation.valid) {
      (server as WebSocket).send(JSON.stringify({ error: 'invalid_payload', name: msg.name }));
      return;
    }

    // Echo back as acknowledgment (placeholder for real GameServer integration)
    (server as WebSocket).send(
      encodeWireMessage('s2c', 's2c:blockChange', { x: 0, y: 0, z: 0, blockId: 0 }),
    );
  });

  (server as WebSocket).addEventListener('close', () => {});

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});

export { app };
export default app;
