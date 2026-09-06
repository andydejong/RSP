import { HUMAN, COMPUTER, TYPES } from './model.js';

// The AI searches four plies in the Small Game and two in the Big Game.
export function chooseComputerMove(model) {
  const moves = model.legalMoves(COMPUTER);
  if (!moves.length) return null;
  const searchPlies = model.mode === 'big' ? 2 : 4;
  let bestScore = -Infinity, best = [];
  moves.forEach(move => {
    const next = model.clone(); next.applyMove(move, { record: false });
    const score = minimax(next, searchPlies - 1, -Infinity, Infinity, false);
    if (score > bestScore) { bestScore = score; best = [move]; }
    else if (score === bestScore) best.push(move);
  });
  return best[Math.floor(Math.random() * best.length)];
}

function minimax(model, depth, alpha, beta, maximizing) {
  if (model.winner === COMPUTER) return 100000 + depth;
  if (model.winner === HUMAN) return -100000 - depth;
  if (model.result === 'stalemate') return 0;
  if (depth === 0) return evaluate(model);
  const owner = maximizing ? COMPUTER : HUMAN;
  const moves = model.legalMoves(owner);
  if (!moves.length) return maximizing ? -90000 : 90000;
  if (maximizing) {
    let value = -Infinity;
    for (const move of moves) { const next = model.clone(); next.applyMove(move, { record: false }); value = Math.max(value, minimax(next, depth - 1, alpha, beta, false)); alpha = Math.max(alpha, value); if (beta <= alpha) break; }
    return value;
  }
  let value = Infinity;
  for (const move of moves) { const next = model.clone(); next.applyMove(move, { record: false }); value = Math.min(value, minimax(next, depth - 1, alpha, beta, true)); beta = Math.min(beta, value); if (beta <= alpha) break; }
  return value;
}

function evaluate(model) {
  const computerMoves = model.legalMoves(COMPUTER), humanMoves = model.legalMoves(HUMAN);
  const computerJumps = computerMoves.filter(move => move.isJump).length, humanJumps = humanMoves.filter(move => move.isJump).length;
  const distance = owner => model.board.flatMap((line, row) => line.map((piece) => piece?.owner === owner && !piece.king ? (owner === COMPUTER ? row : model.size - 1 - row) : 0)).reduce((sum, value) => sum + value, 0);
  const kings = owner => model.countPieces(owner) - model.board.flat().filter(piece => piece?.owner === owner && !piece.king).length;
  let score = (computerJumps - humanJumps) * 24 + (computerMoves.length - humanMoves.length) * 2;
  score += (distance(HUMAN) - distance(COMPUTER)) * 1.5 + (kings(COMPUTER) - kings(HUMAN)) * 8;
  TYPES.forEach(type => { score += (model.captured[COMPUTER][type] - model.captured[HUMAN][type]) * 12; });
  return score;
}
