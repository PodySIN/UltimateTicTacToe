/**
 * Онлайн-транспорт на Firebase Realtime Database.
 * Ходы идут через сервер Google по обычному WebSocket — без WebRTC/NAT/TURN.
 *
 * Структура в базе:
 *   rooms/КОД/host            — id хоста
 *   rooms/КОД/guest           — id гостя
 *   rooms/КОД/toHost/{push}   — входящие сообщения хосту   { from, s: JSON }
 *   rooms/КОД/toGuest/{push}  — входящие сообщения гостю
 * Комната удаляется автоматически, когда хост отключается (onDisconnect).
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  remove,
  onValue,
  onChildAdded,
  onDisconnect,
  runTransaction,
} from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

let db = null;
function getDb() {
  if (db) return db;
  if (!firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes('ВАШ-ПРОЕКТ')) {
    throw new Error('Firebase не настроен: заполните src/lib/firebaseConfig.js');
  }
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getDatabase(app);
  return db;
}

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function makeError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/** Общая часть: отправка, приём входящих, закрытие. */
function attachCommon({ database, code, myId, role, handlers }) {
  const base = `rooms/${code}`;
  const inbox = ref(database, `${base}/${role === 'host' ? 'toHost' : 'toGuest'}`);
  const outboxPath = `${base}/${role === 'host' ? 'toGuest' : 'toHost'}`;
  const unsubs = [];
  let closed = false;

  unsubs.push(
    onChildAdded(inbox, (snap) => {
      const v = snap.val();
      remove(snap.ref).catch(() => {});
      if (!v || typeof v.s !== 'string') return;
      try {
        handlers.onMessage?.(JSON.parse(v.s), v.from);
      } catch (e) {
        console.warn('bad message', e);
      }
    })
  );

  return {
    unsubs,
    send(data) {
      if (closed) return;
      push(ref(database, outboxPath), { from: myId, s: JSON.stringify(data) }).catch((e) =>
        console.warn('send failed', e)
      );
    },
    markClosed() {
      closed = true;
      unsubs.forEach((u) => { try { u(); } catch { /* ignore */ } });
    },
  };
}

/**
 * Создать комнату (хост). Возвращает { code, send(data), leave() }.
 * handlers: { onMessage(data, fromId), onLeave(guestId) }
 */
export async function hostRoom(handlers) {
  const database = getDb();
  const myId = newId();
  let code = null;

  for (let i = 0; i < 8 && !code; i++) {
    const candidate = randomRoomCode(6);
    const res = await runTransaction(ref(database, `rooms/${candidate}/host`), (cur) =>
      cur === null ? myId : undefined
    );
    if (res.committed) code = candidate;
  }
  if (!code) throw makeError('no-code', 'Не удалось подобрать свободный код комнаты');

  const roomRef = ref(database, `rooms/${code}`);
  const hostRef = ref(database, `rooms/${code}/host`);
  const guestRef = ref(database, `rooms/${code}/guest`);
  await onDisconnect(roomRef).remove();

  const common = attachCommon({ database, code, myId, role: 'host', handlers });

  // Гость ушёл → чистим очередь и сообщаем
  let prevGuest = null;
  common.unsubs.push(
    onValue(guestRef, (snap) => {
      const cur = snap.val();
      if (prevGuest && !cur) {
        remove(ref(database, `rooms/${code}/toHost`)).catch(() => {});
        handlers.onLeave?.(prevGuest);
      }
      prevGuest = cur;
    })
  );

  // После обрыва связи сервер удалил комнату (onDisconnect) — восстанавливаем
  let first = true;
  common.unsubs.push(
    onValue(ref(database, '.info/connected'), async (snap) => {
      if (!snap.val()) return;
      if (first) { first = false; return; }
      try {
        await runTransaction(hostRef, (cur) => (cur === null ? myId : undefined));
        await onDisconnect(roomRef).remove();
      } catch (e) {
        console.warn('host reconnect failed', e);
      }
    })
  );

  return {
    code,
    send: (data) => common.send(data),
    leave() {
      common.markClosed();
      onDisconnect(roomRef).cancel().catch(() => {});
      remove(roomRef).catch(() => {});
    },
  };
}

/**
 * Войти в комнату (гость). Бросает Error с code: 'not-found' | 'full'.
 * handlers: { onMessage(data, fromId), onLeave(hostId) }
 */
export async function guestRoom(code, handlers) {
  const database = getDb();
  const myId = newId();

  const hostSnap = await get(ref(database, `rooms/${code}/host`));
  if (!hostSnap.exists()) throw makeError('not-found', 'Комната не найдена');
  const hostId = hostSnap.val();

  const guestRef = ref(database, `rooms/${code}/guest`);
  const res = await runTransaction(guestRef, (cur) => (cur === null ? myId : undefined));
  if (!res.committed) throw makeError('full', 'В комнате уже есть два игрока');
  await onDisconnect(guestRef).remove();

  // Выбрасываем возможные старые сообщения от предыдущего гостя
  await remove(ref(database, `rooms/${code}/toGuest`)).catch(() => {});

  const common = attachCommon({ database, code, myId, role: 'guest', handlers });

  common.unsubs.push(
    onValue(ref(database, `rooms/${code}/host`), (snap) => {
      if (!snap.exists()) handlers.onLeave?.(hostId);
    })
  );

  let first = true;
  common.unsubs.push(
    onValue(ref(database, '.info/connected'), async (snap) => {
      if (!snap.val()) return;
      if (first) { first = false; return; }
      try {
        await runTransaction(guestRef, (cur) => (cur === null ? myId : undefined));
        await onDisconnect(guestRef).remove();
      } catch (e) {
        console.warn('guest reconnect failed', e);
      }
    })
  );

  return {
    hostId,
    send: (data) => common.send(data),
    leave() {
      common.markClosed();
      onDisconnect(guestRef).cancel().catch(() => {});
      runTransaction(guestRef, (cur) => (cur === myId ? null : undefined)).catch(() => {});
    },
  };
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomRoomCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return s;
}

export function shareUrl(roomCode) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  url.hash = '';
  return url.toString();
}

export function parseRoomFromUrl() {
  try {
    const u = new URL(window.location.href);
    const code = (u.searchParams.get('room') || '').trim().toUpperCase();
    return code.length >= 4 ? code : null;
  } catch {
    return null;
  }
}

export function clearRoomFromUrl() {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has('room')) return;
    u.searchParams.delete('room');
    const q = u.searchParams.toString();
    window.history.replaceState({}, '', u.pathname + (q ? `?${q}` : '') + u.hash);
  } catch {
    /* ignore */
  }
}
