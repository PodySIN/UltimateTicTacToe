const KEY = 'neon_bot_saves';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore */
  }
}

export function saveBotGame({ difficulty, game }) {
  if (!game || game.winner) return;
  const list = readAll().filter((g) => g.id !== 'current');
  list.unshift({
    id: 'current',
    type: 'bot',
    difficulty: difficulty || 'medium',
    game,
    savedAt: Date.now(),
  });
  writeAll(list);
}

export function clearBotSave() {
  writeAll(readAll().filter((g) => g.type !== 'bot'));
}

export function listBotSaves() {
  return readAll().filter((g) => g.type === 'bot' && g.game && !g.game.winner);
}

export function loadBotSave(id = 'current') {
  return listBotSaves().find((g) => g.id === id) || null;
}
