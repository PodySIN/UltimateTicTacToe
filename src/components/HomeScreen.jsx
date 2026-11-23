import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { playTone } from '../lib/audio';
import { loadBotSave } from '../lib/botSave';
import { parseRoomFromUrl } from '../lib/peer';

const MODES = [
  { id: 'local', title: 'Двое на одном устройстве', desc: 'Ходите по очереди на одном экране', icon: '👥' },
  { id: 'bot', title: 'Против бота', desc: 'Три уровня сложности', icon: '🤖' },
  { id: 'online', title: 'По сети', desc: 'Код комнаты или ссылка — до двух игроков', icon: '🌐' },
];

export default function HomeScreen() {
  const {
    selectedMode, setSelectedMode, difficulty, setDifficulty,
    startLocal, startBot, resumeBot,
    createOnlineRoom, joinOnlineRoom,
    peerError, clearPeerError,
    roomCode, shareLink, status, mode,
  } = useGameStore();

  const [savedBot, setSavedBot] = useState(null);
  const [roomInput, setRoomInput] = useState('');
  const [onlineAction, setOnlineAction] = useState(null); // 'create' | 'join'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSavedBot(loadBotSave());
  }, []);

  // Авто-вход по ссылке ?room=XXXX
  useEffect(() => {
    const fromUrl = parseRoomFromUrl();
    if (fromUrl) {
      setSelectedMode('online');
      setOnlineAction('join');
      setRoomInput(fromUrl);
    }
  }, [setSelectedMode]);

  const canStart =
    selectedMode === 'local' ||
    selectedMode === 'bot' ||
    (selectedMode === 'online' && onlineAction === 'create') ||
    (selectedMode === 'online' && onlineAction === 'join' && roomInput.trim().length >= 4);

  const handleStart = () => {
    playTone('click');
    clearPeerError();
    if (selectedMode === 'local') startLocal();
    else if (selectedMode === 'bot') startBot(difficulty);
    else if (selectedMode === 'online') {
      if (onlineAction === 'create') createOnlineRoom();
      else if (onlineAction === 'join') joinOnlineRoom(roomInput.trim().toUpperCase());
    }
  };

  const handleResume = () => {
    if (!savedBot) return;
    playTone('click');
    resumeBot(savedBot);
  };

  const copyCode = async () => {
    const text = roomCode || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      playTone('click');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const copyLink = async () => {
    const text = shareLink || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      playTone('click');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const connecting = mode === 'connecting' && status === 'waiting';
  const waitingForOpponent = mode === 'online' && status === 'waiting' && roomCode;

  return (
    <div className="home">
      <div className="home-inner">
        <div className="hero-kicker">
          <span className="live-dot" />
          SUPER TIC-TAC-TOE
        </div>
        <h1>
          <span className="gradient-text">Крестики-нолики</span>
        </h1>
        <p className="hero-sub">
          Каждое поле — своя мини-доска. Ход в клетке N отправляет соперника на большое
          поле N. Победа — три больших поля в ряд.
        </p>

        <div className="modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-card ${selectedMode === m.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMode(m.id);
                clearPeerError();
                playTone('click');
              }}
            >
              <div className="mode-icon">{m.icon}</div>
              <div>
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {selectedMode === 'bot' && (
          <div className="difficulty-row">
            {['easy', 'medium', 'hard'].map((d) => (
              <button
                key={d}
                type="button"
                className={`diff-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d === 'easy' ? 'Лёгкий' : d === 'medium' ? 'Средний' : 'Сложный'}
              </button>
            ))}
          </div>
        )}

        {selectedMode === 'online' && !waitingForOpponent && !connecting && (
          <div className="online-panel">
            <div className="difficulty-row" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={`diff-btn ${onlineAction === 'create' ? 'active' : ''}`}
                onClick={() => { setOnlineAction('create'); playTone('click'); }}
              >
                Создать комнату
              </button>
              <button
                type="button"
                className={`diff-btn ${onlineAction === 'join' ? 'active' : ''}`}
                onClick={() => { setOnlineAction('join'); playTone('click'); }}
              >
                Войти по коду
              </button>
            </div>
            {onlineAction === 'join' && (
              <input
                className="room-input"
                type="text"
                placeholder="Код комнаты"
                maxLength={8}
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
            )}
            <p className="online-hint">
              Создайте комнату и отправьте другу код или ссылку, чтобы сыграть вместе.
            </p>
          </div>
        )}

        {connecting && (
          <div className="online-panel connection-panel" role="status" aria-live="polite">
            <div className="connection-spinner" aria-hidden="true" />
            <div className="connection-copy">
              <strong>{selectedMode === 'online' && onlineAction === 'join' ? 'Подключаемся к комнате' : 'Создаём комнату'}</strong>
              <span>Это займёт всего несколько секунд</span>
            </div>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => { playTone('click'); useGameStore.getState().leaveToMenu(); }}
            >
              Отменить
            </button>
          </div>
        )}

        {waitingForOpponent && (
          <div className="online-panel waiting-box">
            <p className="waiting-title">Комната создана — ждём соперника</p>
            <div className="room-code-big">{roomCode}</div>
            <div className="copy-row">
              <button type="button" className="diff-btn active" onClick={copyCode}>
                {copied ? 'Скопировано' : 'Копировать код'}
              </button>
              <button type="button" className="diff-btn" onClick={copyLink}>
                Копировать ссылку
              </button>
            </div>
            <p className="online-hint">
              Отправьте код или ссылку другу. Когда он подключится — игра начнётся.
            </p>
          </div>
        )}

        {peerError && (
          <p className="error-banner" role="alert">
            {peerError}
          </p>
        )}

        {selectedMode === 'bot' && savedBot && (
          <button
            type="button"
            className="start-btn resume-btn"
            onClick={handleResume}
          >
            <span className="resume-icon" aria-hidden="true">↗</span>
            <span className="resume-copy"><strong>Продолжить партию</strong><small>Вернуться к сохранённой игре против бота</small></span>
          </button>
        )}

        {!waitingForOpponent && !connecting && (
          <button
            type="button"
            className="start-btn"
            disabled={!canStart}
            onClick={handleStart}
          >
            {selectedMode === 'online' && onlineAction === 'join'
              ? 'Войти в комнату'
              : selectedMode === 'online' && onlineAction === 'create'
                ? 'Создать комнату'
                : 'Начать игру'}
          </button>
        )}

        {waitingForOpponent && (
          <button
            type="button"
            className="start-btn cancel-room-btn"
            onClick={() => {
              playTone('click');
              useGameStore.getState().leaveToMenu();
            }}
          >
            <span aria-hidden="true">×</span> Отменить ожидание
          </button>
        )}
      </div>
    </div>
  );
}
