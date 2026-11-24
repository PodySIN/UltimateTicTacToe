/** Supabase Realtime transport (Broadcast for game packets, Presence for room members). */
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabaseConfig';

let client;
function getClient() {
  if (client) return client;
  if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
    throw makeError('config', 'Supabase не настроен');
  }
  client = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomRoomCode(len = 6) {
  let result = '';
  for (let i = 0; i < len; i++) result += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return result;
}

function countRole(state, role) {
  return Object.values(state || {}).flat().filter((presence) => presence?.role === role).length;
}

function openChannel(code, role, handlers) {
  return new Promise((resolve, reject) => {
    const supabase = getClient();
    const clientId = `${role}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    const channel = supabase.channel(`ultimate-ttt-${code}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: clientId, enabled: true },
        private: false,
      },
    });
    let settled = false;
    let closed = false;
    let sawOpponent = false;
    let opponentId = null;
    let resolvePresenceSync;
    const presenceSynced = new Promise((resolve) => { resolvePresenceSync = resolve; });
    let timeout;

    const cleanup = async () => {
      if (closed) return;
      closed = true;
      clearTimeout(timeout);
      try { await channel.untrack(); } catch { /* ignore */ }
      try { await supabase.removeChannel(channel); } catch { /* ignore */ }
    };

    const fail = async (error) => {
      if (settled) return;
      settled = true;
      await cleanup();
      reject(error);
    };

    channel
      .on('broadcast', { event: 'game-message' }, ({ payload }) => {
        if (!payload || payload.from === clientId || !payload.data) return;
        handlers.onMessage?.(payload.data, payload.from || 'supabase-peer');
      })
      .on('presence', { event: 'sync' }, () => {
        resolvePresenceSync?.();
        if (closed) return;
        const state = channel.presenceState();
        const opponentRole = role === 'host' ? 'guest' : 'host';
        const opponentCount = countRole(state, opponentRole);
        if (opponentCount > 0) {
          sawOpponent = true;
          const opponent = Object.values(state).flat().find((p) => p?.role === opponentRole);
          opponentId = opponent?.clientId || (role === 'host' ? 'supabase-guest' : 'supabase-host');
          if (role === 'host' && opponent) handlers.onJoin?.(opponentId);
        } else if (sawOpponent) {
          handlers.onLeave?.(opponentId || (role === 'host' ? 'supabase-guest' : 'supabase-host'));
          sawOpponent = false;
          opponentId = null;
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const opponentRole = role === 'host' ? 'guest' : 'host';
        const departed = (leftPresences || []).find((p) => p?.role === opponentRole);
        if (departed) {
          handlers.onLeave?.(departed.clientId || opponentId || (role === 'host' ? 'supabase-guest' : 'supabase-host'));
          sawOpponent = false;
          opponentId = null;
        }
      })
      .subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          try {
            await Promise.race([presenceSynced, new Promise((resolve) => setTimeout(resolve, 1800))]);
            const state = channel.presenceState();
            if (role === 'host' && countRole(state, 'host') > 0) {
              await fail(makeError('code-exists', 'Код комнаты уже занят'));
              return;
            }
            if (role === 'guest' && countRole(state, 'host') < 1) {
              await fail(makeError('not-found', 'Комната не найдена'));
              return;
            }
            if (role === 'guest' && countRole(state, 'guest') > 0) {
              await fail(makeError('full', 'В комнате уже есть два игрока'));
              return;
            }
            const tracked = await channel.track({ role, clientId, joinedAt: Date.now() });
            if (tracked !== 'ok') throw new Error(`Presence track: ${tracked}`);
            if (!settled) {
              settled = true;
              resolve({
                id: clientId,
                send(data) {
                  if (closed) return;
                  channel.send({ type: 'broadcast', event: 'game-message', payload: { from: clientId, data } })
                    .catch((sendError) => console.warn('Supabase send failed', sendError));
                },
                async leave() { await cleanup(); },
              });
            }
          } catch (e) {
            await fail(makeError('connect', e?.message || 'Не удалось подключиться к Supabase'));
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          await fail(makeError('connect', error?.message || `Supabase Realtime: ${status}`));
        }
      });

    timeout = setTimeout(() => {
      fail(makeError('timeout', 'Supabase не ответил вовремя'));
    }, 10000);
  });
}

export async function hostRoom(handlers) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomRoomCode(8);
    try {
      const connection = await openChannel(code, 'host', handlers);
      return { code, ...connection };
    } catch (error) {
      lastError = error;
      if (error?.code === 'config') throw error;
    }
  }
  throw makeError('connect', lastError?.message || 'Не удалось создать комнату Supabase');
}

export async function guestRoom(code, handlers) {
  return openChannel(code, 'guest', handlers).then((connection) => ({ hostId: 'supabase-host', ...connection }));
}
