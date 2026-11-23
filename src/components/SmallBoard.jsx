import Cell from './Cell';

export default function SmallBoard({
  boardIndex, cells, winner, isActive, isDimmed, lastMove, onCellClick, disabled,
}) {
  const cls = [
    'small-board',
    isActive && 'active',
    isDimmed && 'dimmed',
    winner === 'X' && 'won-x',
    winner === 'O' && 'won-o',
    winner === 'D' && 'won-d',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      {winner && (
        <div className={`small-winner ${String(winner).toLowerCase()}`}>
          {winner === 'D' ? '—' : winner}
        </div>
      )}
      {cells.map((value, cellIndex) => (
        <Cell
          key={cellIndex}
          value={value}
          isLast={lastMove?.board === boardIndex && lastMove?.cell === cellIndex}
          disabled={disabled || !!winner || isDimmed}
          onClick={() => onCellClick(boardIndex, cellIndex)}
        />
      ))}
    </div>
  );
}
