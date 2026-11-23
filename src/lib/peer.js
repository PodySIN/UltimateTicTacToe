/**
 * Online transport backed by Cloudflare Workers + Durable Objects.
 * One Durable Object is allocated per room code and relays messages over WebSockets.
 */
import { WORKER_URL } from './cloudflareConfig';

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function inspectRoom(code) {
  let response;
  try {
    response = await fetch(`${WORKER_URL}/api/rooms/${encodeURIComponent(code)}?check=1`, {
      method: 'GET',
      cache: 'no-store',
    });
  } catch {
    throw makeError('network', 'Не удалось связаться с сервером Cloudflare');
  }
  if (!response.ok) throw makeError('network', `Cloudflare ответил с ошибкой (${response.status})`);
  return response.json();
}

function connectSocket(code, role, handlers) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(`${WORKER_URL}/api/rooms/${encodeURIComponent(code)}`);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    endpoint.searchParams.set('role', role);
    const socket = new WebSocket(endpoint.toString());
    let settled = false;
    let myId = null;
    let peerId = null;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch { /* ignore */ }
      reject(error);
    };

    socket.addEventListener('message', (event) => {
      let packet;
      try { packet = JSON.parse(event.data); } catch { return; }
      if (packet?.type === '_ready') {
        myId = packet.id;
        if (!settled) {
          settled = true;
          resolve({
            id: myId,
            send(data) {
              if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
            },
            leave() {
              if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close(1000, 'left');
              }
            },
          });
        }
        return;
      }
      if (packet?.type === '_peer-left') {
        if (packet.id) handlers.onLeave?.(packet.id);
        return;
      }
      if (packet?.__relay && packet.data && typeof packet.data === 'object') {
        peerId = packet.from || peerId;
        handlers.onMessage?.(packet.data, packet.from);
      }
    });

    socket.addEventListener('error', () => {
      fail(makeError('connect', 'Не удалось подключиться к Cloudflare. Проверьте доступность Worker.'));
    });
    socket.addEventListener('close', (event) => {
      if (!settled) {
        if (event.code === 4404) fail(makeError('not-found', 'Комната не найдена'));
        else if (event.code === 4409) fail(makeError('full', 'В комнате уже есть два игрока'));
        else fail(makeError('connect', 'Соединение с комнатой не установлено'));
      } else if (peerId) {
        handlers.onLeave?.(peerId);
      }
    });
  });
}

export async function hostRoom(handlers) {
  let code = null;
  let connection = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomRoomCode(6);
    const state = await inspectRoom(candidate);
    if (state.hostConnected) continue;
    code = candidate;
    try {
      connection = await connectSocket(code, 'host', handlers);
      break;
    } catch (error) {
      if (error?.code === 'full') continue;
      throw error;
    }
  }
  if (!code || !connection) throw makeError('no-code', 'Не удалось создать свободную комнату');
  return { code, send: connection.send, leave: connection.leave };
}

export async function guestRoom(code, handlers) {
  const state = await inspectRoom(code);
  if (!state.hostConnected) throw makeError('not-found', 'Комната не найдена');
  if (state.guestConnected) throw makeError('full', 'В комнате уже есть два игрока');
  const connection = await connectSocket(code, 'guest', handlers);
  return { hostId: 'host', send: connection.send, leave: connection.leave };
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomRoomCode(len = 6) {
  let result = '';
  for (let i = 0; i < len; i++) result += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return result;
}

export function shareUrl(roomCode) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  url.hash = '';
  return url.toString();
}

export function parseRoomFromUrl() {
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get('room') || '').trim().toUpperCase();
    return code.length >= 4 ? code : null;
  } catch { return null; }
}

export function clearRoomFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('room')) return;
    url.searchParams.delete('room');
    const query = url.searchParams.toString();
    window.history.replaceState({}, '', url.pathname + (query ? `?${query}` : '') + url.hash);
  } catch { /* ignore */ }
}
