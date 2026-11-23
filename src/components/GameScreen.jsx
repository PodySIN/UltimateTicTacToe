import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import GameBoard from './GameBoard';
import Modal from './Modal';
import { isFinished } from '../lib/gameLogic';
import { playTone } from '../lib/audio';
import { clearBotSave } from '../lib/botSave';

export default function GameScreen() {
  const {
    mode, game, difficulty, playerMark,
    status, showWinModal, makeMove, resetGame, leaveToMenu,
    roomCode, opponentConnected, peerError, onlineRole,
  } = useGameStore();

  const isMyTurn =
    mode === 'local' ||
    (mode === 'bot' && game.current === playerMark) ||
    (mode === 'online' && game.current === playerMark && opponentConnected);

  const turnLabel = () => {
    if (isFinished(game)) {
      if (game.winner === 'D') return 'Ничья';
      return `Победа ${game.winner}`;
    }
    if (mode === 'bot') return game.current === 'X' ? 'Ваш ход' : 'Ход бота…';
    if (mode === 'online') {
      if (!opponentConnected) return 'Соперник отключился';
      return game.current === playerMark ? 'Ваш ход' : 'Ход соперника…';
    }
    return `Ход ${game.current}`;
  };

  const handleMove = (board, cell) => {
    if (!isMyTurn) return;
    makeMove(board, cell);
  };

  const resultTitle = () => {
    if (game.winner === 'D') return 'Ничья';
    if (mode === 'bot') return game.winner === 'X' ? 'Вы победили!' : 'Бот победил';
    if (mode === 'online') {
      if (game.winner === playerMark) return 'Вы победили!';
      return 'Поражение';
    }
    return `Победа ${game.winner}`;
  };

  const goMenu = () => {
    playTone('click');
    leaveToMenu();
  };

  const [rematchSent, setRematchSent] = useState(false);

  const surrender = () => {
    if (mode === 'bot') {
      if (!window.confirm('Сдаться? Бот победит.')) return;
      playTone('click');
      clearBotSave();
      useGameStore.setState({
        game: { ...game, winner: 'O' },
        status: 'finished',
        showWinModal: true,
      });
      return;
    }
  };

  return (
    <div className="game-screen">
      <div className="game-header">
        <div className="game-header-info">
          <span className={`status-pill ${isFinished(game) ? 'win' : game.current === 'X' ? 'x' : 'o'}`}>
            {turnLabel()}
          </span>
          {mode === 'bot' && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {difficulty === 'easy' ? 'Лёгкий' : difficulty === 'medium' ? 'Средний' : 'Сложный'}
            </span>
          )}
          {mode === 'online' && (
            <div className="game-meta">
              <span>{playerMark === 'X' ? 'Вы — ✕' : 'Вы — ○'}</span>
              {roomCode && <button type="button" className="room-code-chip" title="Скопировать код комнаты" onClick={() => navigator.clipboard?.writeText(roomCode)}>{roomCode} · копировать</button>}
              <span className={opponentConnected ? 'connection-state connected' : 'connection-state'}>{opponentConnected ? 'Соперник онлайн' : 'Нет связи'}</span>
            </div>
          )}
        </div>
        <div className="game-header-actions">
          {mode === 'bot' && !isFinished(game) && (
            <button type="button" className="back-btn" onClick={surrender}>
              Сдаться
            </button>
          )}
          <button type="button" className="back-btn" onClick={goMenu}>
            ← Меню
          </button>
        </div>
      </div>

      {peerError && mode === 'online' && (
        <p className="error-banner" role="alert" style={{ marginBottom: 12 }}>
          {peerError}
        </p>
      )}

      <div className="game-play-area">
        <GameBoard game={game} onMove={handleMove} interactive={status === 'playing' && isMyTurn} />
        <p className="hint">
          {game.nextBoard !== null && !isFinished(game)
            ? `Следующий ход только в поле ${game.nextBoard + 1}`
            : !isFinished(game)
              ? 'Можно ходить в любое свободное поле'
              : ''}
        </p>
      </div>

      {showWinModal && (
        <Modal
          title={resultTitle()}
          actions={
            <>
              <button type="button" className="modal-btn primary" onClick={() => { setRematchSent(mode === 'online' && onlineRole === 'guest'); resetGame(); }}>
                {mode === 'online' && onlineRole === 'guest' ? 'Запросить реванш' : mode === 'online' ? 'Реванш' : 'Ещё раз'}
              </button>
              <button type="button" className="modal-btn" onClick={goMenu}>
                В меню
              </button>
            </>
          }
        >
          <p>
            {game.winner === 'D'
              ? 'Все большие поля заполнены без трёх в ряд.'
              : 'Три больших поля в ряд.'}
          </p>
          {mode === 'online' && onlineRole === 'guest' && (
            <p className="rematch-note">{rematchSent ? 'Запрос отправлен. Ожидаем начала новой игры…' : 'Предложите сопернику сыграть ещё одну партию.'}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
