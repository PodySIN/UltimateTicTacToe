export const LINES = Object.freeze([
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]);
const SIZE = 9;

export function getWinner(cells) {
  for (const [a, b, c] of LINES) {
    const mark = cells[a];
    if (mark && mark !== 'D' && mark === cells[b] && mark === cells[c]) return mark;
  }
  return cells.every(Boolean) ? 'D' : null;
}

export function createGame(firstPlayer = 'X') {
  return {
    boards: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
    small: Array(SIZE).fill(null),
    nextBoard: null,
    current: firstPlayer,
    winner: null,
    lastMove: null,
    moveCount: 0,
  };
}

export function legalBoards(game) {
  if (game.winner) return [];
  if (game.nextBoard !== null && game.small[game.nextBoard] === null) return [game.nextBoard];
  return game.small.map((s, i) => (s === null ? i : -1)).filter((i) => i >= 0);
}

export function legalMoves(game) {
  const moves = [];
  for (const board of legalBoards(game)) {
    for (let cell = 0; cell < SIZE; cell++) {
      if (!game.boards[board][cell]) moves.push([board, cell]);
    }
  }
  return moves;
}

export function play(game, board, cell) {
  if (game.winner) return null;
  if (!Number.isInteger(board) || board < 0 || board >= SIZE) return null;
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE) return null;
  if (!legalBoards(game).includes(board)) return null;
  if (game.boards[board][cell]) return null;

  const boards = game.boards.map((b, i) =>
    i === board ? b.map((c, j) => (j === cell ? game.current : c)) : b
  );
  const small = [...game.small];
  small[board] = getWinner(boards[board]);
  const overall = getWinner(small);
  let nextBoard = cell;
  if (small[nextBoard] !== null) nextBoard = null;

  return {
    boards,
    small,
    nextBoard,
    current: game.current === 'X' ? 'O' : 'X',
    winner: overall,
    lastMove: { board, cell },
    moveCount: game.moveCount + 1,
  };
}

export function isFinished(game) {
  return game.winner !== null;
}
