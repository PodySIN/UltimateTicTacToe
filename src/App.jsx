import { useState, useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import HomeScreen from './components/HomeScreen';
import GameScreen from './components/GameScreen';
import Modal from './components/Modal';
import { playTone, setSoundEnabled, isSoundEnabled } from './lib/audio';

export default function App() {
  const mode = useGameStore((s) => s.mode);
  const status = useGameStore((s) => s.status);

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('neon_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [sound, setSound] = useState(() => isSoundEnabled());
  const [showRules, setShowRules] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('neon_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playTone('click');
  };

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    playTone('click');
  };

  const inGame =
    mode === 'local' ||
    mode === 'bot' ||
    (mode === 'online' && (status === 'playing' || status === 'finished' || status === 'error'));

  // connecting / waiting host still shows home (with waiting UI)
  const showGame = inGame;

  return (
    <div className="app">
      <header className="topbar">
        <div
          className="brand"
          onClick={() => {
            if (showGame || mode === 'online' || mode === 'connecting') {
              useGameStore.getState().leaveToMenu();
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <span className="brand-mark">✕○</span>
          <span className="brand-text">Neon TTT</span>
        </div>

        <div className="topbar-actions" ref={menuRef}>
          <button type="button" className="icon-btn" onClick={toggleSound} title={sound ? 'Звук вкл' : 'Звук выкл'}>
            {sound ? '🔊' : '🔇'}
          </button>
          <button type="button" className="icon-btn" onClick={toggleTheme} title="Тема">
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowRules(true)} title="Правила">
            ?
          </button>
        </div>
      </header>

      <main className="main">
        {showGame ? <GameScreen /> : <HomeScreen />}
      </main>

      {showRules && (
        <Modal
          title="Правила"
          actions={
            <button type="button" className="modal-btn primary" onClick={() => setShowRules(false)}>
              Понятно
            </button>
          }
        >
          <div className="rules">
            <p>
              Это <b>Ultimate Tic-Tac-Toe</b> (супер-крестики-нолики).
            </p>
            <ul>
              <li>Большое поле состоит из 9 мини-полей 3×3.</li>
              <li>Ход делается в одну клетку мини-поля.</li>
              <li>Если вы ходите в клетку N, соперник обязан ходить в большое поле N.</li>
              <li>Если нужное поле уже занято (выиграно или ничья) — можно ходить в любое свободное.</li>
              <li>Кто первым выиграет три больших поля в ряд — побеждает.</li>
            </ul>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              Онлайн: один создаёт комнату и делится кодом/ссылкой, второй входит по коду.
              Для игры по сети создайте комнату и пригласите второго игрока по ссылке или коду.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
