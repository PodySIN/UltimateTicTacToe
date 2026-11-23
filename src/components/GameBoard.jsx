import { legalBoards } from '../lib/gameLogic';
import SmallBoard from './SmallBoard';

export default function GameBoard({ game, onMove, interactive = true }) {
  const allowed = legalBoards(game);
  const hasRestriction = game.nextBoard !== null && allowed.length === 1;

  return (
    <div className="board-wrap">
      <div className="big-board">
        {game.boards.map((cells, boardIndex) => {
          const isActive = interactive && !game.winner && allowed.includes(boardIndex);
          const isDimmed =
            interactive && !game.winner && hasRestriction && !allowed.includes(boardIndex);
          return (
            <SmallBoard
              key={boardIndex}
              boardIndex={boardIndex}
              cells={cells}
              winner={game.small[boardIndex]}
              isActive={isActive}
              isDimmed={isDimmed}
              lastMove={game.lastMove}
              disabled={!interactive || !!game.winner}
              onCellClick={onMove}
            />
          );
        })}
      </div>
    </div>
  );
}
