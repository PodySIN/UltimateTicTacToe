/** Multi-backend transport selector. The chosen provider is embedded in the invite URL. */
import * as firebase from './firebasePeer';
import * as supabase from './supabasePeer';
import * as cloudflare from './cloudflarePeer';

const adapters = { firebase, supabase, cloudflare };
let preferredProvider = null;

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getProviderFromUrl() {
  try {
    const value = new URL(window.location.href).searchParams.get('backend');
    return adapters[value] ? value : null;
  } catch { return null; }
}

function hostOrder() {
  // Firebase gets the larger share; Supabase absorbs overflow; Cloudflare is last resort.
  return Math.random() < 0.70
    ? ['firebase', 'supabase', 'cloudflare']
    : ['supabase', 'firebase', 'cloudflare'];
}

export async function hostRoom(handlers) {
  const errors = [];
  for (const provider of hostOrder()) {
    try {
      const room = await adapters[provider].hostRoom(handlers);
      preferredProvider = provider;
      return { ...room, backend: provider };
    } catch (error) {
      errors.push(`${provider}: ${error?.message || error}`);
      console.warn(`${provider} room creation failed; trying next backend`, error);
    }
  }
  throw makeError('all-backends-failed', `Не удалось создать комнату ни в одном сервисе. ${errors.join(' | ')}`);
}

export async function guestRoom(code, handlers) {
  const explicit = getProviderFromUrl();
  const order = explicit
    ? [explicit, ...['firebase', 'supabase', 'cloudflare'].filter((name) => name !== explicit)]
    : ['firebase', 'supabase', 'cloudflare'];
  const errors = [];

  for (const provider of order) {
    try {
      const room = await adapters[provider].guestRoom(code, handlers);
      preferredProvider = provider;
      return { ...room, backend: provider };
    } catch (error) {
      errors.push(`${provider}: ${error?.message || error}`);
      // A room exists only in the backend selected by its host. Probe the next service
      // when it is absent or unreachable; never move one player to a different room.
    }
  }
  const notFound = errors.length && errors.every((entry) => entry.includes('not-found'));
  throw makeError(notFound ? 'not-found' : 'connect', notFound
    ? 'Комната не найдена ни в одном сервисе. Проверьте код.'
    : 'Не удалось подключиться к комнате ни через один сервис. Возможно, один из сервисов недоступен в вашей сети.');
}

export function shareUrl(roomCode, backend = preferredProvider || 'firebase') {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  url.searchParams.set('backend', backend);
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
    if (!url.searchParams.has('room') && !url.searchParams.has('backend')) return;
    url.searchParams.delete('room');
    url.searchParams.delete('backend');
    const query = url.searchParams.toString();
    window.history.replaceState({}, '', url.pathname + (query ? `?${query}` : '') + url.hash);
  } catch { /* ignore */ }
}
