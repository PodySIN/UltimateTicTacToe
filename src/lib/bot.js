import { legalMoves, play, getWinner, isFinished } from './gameLogic.js';

function randomMove(game) {
  const moves = legalMoves(game);
  if (!moves.length) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

function boardScore(cells, player) {
  const opp = player === 'X' ? 'O' : 'X';
  const w = getWinner(cells);
  if (w === player) return 100;
  if (w === opp) return -100;
  if (w === 'D') return 0;
  let score = 0;
  const weights = [3, 2, 3, 2, 4, 2, 3, 2, 3];
  for (let i = 0; i < 9; i++) {
    if (cells[i] === player) score += weights[i];
    if (cells[i] === opp) score -= weights[i];
  }
  return score;
}

function evaluate(game, player) {
  if (game.winner === player) return 10000;
  if (game.winner && game.winner !== 'D') return -10000;
  if (game.winner === 'D') return 0;
  let score = 0;
  for (let i = 0; i < 9; i++) {
    score += boardScore(game.boards[i], player) * 10;
    if (game.small[i] === player) score += 50;
    if (game.small[i] && game.small[i] !== 'D' && game.small[i] !== player) score -= 50;
  }
  return score;
}

function minimax(game, depth, maximizing, player, alpha, beta) {
  if (depth === 0 || isFinished(game)) return evaluate(game, player);
  const moves = legalMoves(game);
  if (!moves.length) return evaluate(game, player);
  if (maximizing) {
    let maxEval = -Infinity;
    for (const [b, c] of moves) {
      const next = play(game, b, c);
      if (!next) continue;
      const val = minimax(next, depth - 1, false, player, alpha, beta);
      maxEval = Math.max(maxEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return maxEval;
  }
  let minEval = Infinity;
  for (const [b, c] of moves) {
    const next = play(game, b, c);
    if (!next) continue;
    const val = minimax(next, depth - 1, true, player, alpha, beta);
    minEval = Math.min(minEval, val);
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return minEval;
}

function bestMoveHard(game, player) {
  const moves = legalMoves(game);
  if (!moves.length) return null;
  const depth = moves.length > 18 ? 2 : moves.length > 10 ? 3 : 4;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const [b, c] of moves) {
    const next = play(game, b, c);
    if (!next) continue;
    const score = minimax(next, depth - 1, false, player, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = [b, c];
    }
  }
  return best;
}

function bestMoveMedium(game, player) {
  const moves = legalMoves(game);
  if (!moves.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const [b, c] of moves) {
    const next = play(game, b, c);
    if (!next) continue;
    let score = evaluate(next, player);
    if (next.small[b] === player) score += 200;
    if (next.nextBoard === null) score += 30;
    if (score > bestScore) {
      bestScore = score;
      best = [b, c];
    }
  }
  return best || moves[0];
}

export function getBotMove(game, difficulty = 'medium', botPlayer = 'O') {
  if (isFinished(game) || game.current !== botPlayer) return null;
  switch (difficulty) {
    case 'easy':
      return randomMove(game);
    case 'hard':
      return bestMoveHard(game, botPlayer);
    default:
      return bestMoveMedium(game, botPlayer);
  }
}
