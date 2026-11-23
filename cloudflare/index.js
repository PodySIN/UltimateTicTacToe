const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{4,12})$/i);
    if (!match) return json({ ok: true, service: 'Neon Ultimate Tic-Tac-Toe backend' });

    const code = match[1].toUpperCase();
    const id = env.ROOMS.idFromName(code);
    const stub = env.ROOMS.get(id);

    if (url.searchParams.get('check') === '1') {
      const response = await stub.fetch('https://room.internal/check');
      const body = await response.json();
      return json(body, response.status);
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'WebSocket upgrade required' }, 426);
    }
    const role = url.searchParams.get('role');
    if (role !== 'host' && role !== 'guest') return json({ error: 'Invalid role' }, 400);
    return stub.fetch(new Request(`https://room.internal/connect?role=${role}`, request));
  },
};

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/check') {
      const sockets = this.ctx.getWebSockets();
      const roles = sockets.map((socket) => socket.deserializeAttachment()?.role);
      return Response.json({
        hostConnected: roles.includes('host'),
        guestConnected: roles.includes('guest'),
      });
    }

    if (url.pathname !== '/connect') return new Response('Not found', { status: 404 });
    const role = url.searchParams.get('role');
    const sockets = this.ctx.getWebSockets();
    const attachments = sockets.map((socket) => ({ socket, data: socket.deserializeAttachment() }));
    const host = attachments.find((entry) => entry.data?.role === 'host');
    const guest = attachments.find((entry) => entry.data?.role === 'guest');

    if (role === 'guest' && !host) return new Response('Room not found', { status: 404 });
    if ((role === 'host' && host) || (role === 'guest' && guest)) {
      return new Response('Room full', { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const id = crypto.randomUUID();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role, id });
    server.send(JSON.stringify({ type: '_ready', id }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(sender, message) {
    if (typeof message !== 'string' || message.length > 16000) return;
    let parsed;
    try { parsed = JSON.parse(message); } catch { return; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const senderData = sender.deserializeAttachment();
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === sender) continue;
      try {
        socket.send(JSON.stringify({ __relay: true, from: senderData?.id, data: parsed }));
      } catch { /* socket may be closing */ }
    }
  }

  webSocketClose(socket, code, reason, wasClean) {
    this.notifyPeerLeft(socket);
  }

  webSocketError(socket, error) {
    this.notifyPeerLeft(socket);
  }

  notifyPeerLeft(closedSocket) {
    const closedData = closedSocket.deserializeAttachment();
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === closedSocket) continue;
      try {
        socket.send(JSON.stringify({ type: '_peer-left', id: closedData?.id }));
        if (closedData?.role === 'host') socket.close(4001, 'Host left');
      } catch { /* socket may already be closed */ }
    }
  }
}
