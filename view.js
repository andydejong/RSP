export class GameView {
  constructor() { this.board = document.querySelector('#board'); this.statusTitle = document.querySelector('#statusTitle'); this.statusDetail = document.querySelector('#statusDetail'); this.turnReadout = document.querySelector('#turnReadout'); this.humanCount = document.querySelector('#humanCount'); this.computerCount = document.querySelector('#computerCount'); this.captureScore = document.querySelector('#captureScore'); this.endTurn = document.querySelector('#endTurn'); }
  bindSquareClick(handler) { this.board.addEventListener('click', event => { const square = event.target.closest('[data-row]'); if (square) handler(Number(square.dataset.row), Number(square.dataset.col)); }); }
  bindEndTurn(handler) { this.endTurn.addEventListener('click', handler); }
  render(model, legal = []) {
    const legalKeys = new Set(legal.map(move => move.to.join(','))); this.board.style.gridTemplateColumns = `repeat(${model.size}, 1fr)`; this.board.style.gridTemplateRows = `repeat(${model.size}, 1fr)`; this.board.innerHTML = '';
    for (let row = 0; row < model.size; row++) for (let col = 0; col < model.size; col++) {
      const square = document.createElement('button'); square.type = 'button'; square.className = `square ${(row + col) % 2 ? 'dark' : 'light'}`; square.dataset.row = row; square.dataset.col = col; square.setAttribute('role', 'gridcell');
      const key = `${row},${col}`; if (legalKeys.has(key)) square.classList.add('legal'); if (model.selected?.[0] === row && model.selected?.[1] === col) square.classList.add('selected');
      if (model.lastComputerMove && (this.same(model.lastComputerMove.from, [row, col]) || model.lastComputerMove.landed.some(point => this.same(point, [row, col])) || this.same(model.lastComputerMove.to, [row, col]) || model.lastComputerMove.jumped.some(point => this.same(point, [row, col])))) square.classList.add('computer-dot');
      const piece = model.board[row][col]; if (piece) { const token = document.createElement('span'); token.className = `piece ${piece.owner} ${piece.king ? 'king' : ''}`; token.textContent = piece.type[0].toUpperCase(); token.title = `${piece.owner} ${piece.type}${piece.king ? ', king' : ''}`; square.append(token); }
      const pendingCapture = model.pendingComputerCaptures?.find(capture => this.same(capture.at, [row, col])); if (!piece && pendingCapture) { const token = document.createElement('span'); token.className = `piece ${pendingCapture.piece.owner} captured-pending`; token.textContent = pendingCapture.piece.type[0].toUpperCase(); token.title = `${pendingCapture.piece.owner} ${pendingCapture.piece.type}`; square.append(token); }
      this.board.append(square);
    }
    const humanPieces = model.countPieces('human'), computerPieces = model.countPieces('computer'); this.humanCount.textContent = `${humanPieces} piece${humanPieces === 1 ? '' : 's'}`; this.computerCount.textContent = `${computerPieces} piece${computerPieces === 1 ? '' : 's'}`;
    this.captureScore.hidden = model.mode !== 'big';
    ['human', 'computer'].forEach(owner => ['rock', 'scissors', 'paper'].forEach(type => {
      document.querySelector(`#${owner}Captured${type[0].toUpperCase()}${type.slice(1)}`).textContent = model.captured[owner][type];
    }));
    const continuation = model.compoundJump ? model.movesFor(...model.compoundJump.current) : [];
    this.endTurn.hidden = !model.compoundJump || !continuation.length || model.isOver();
    this.updateStatus(model);
    document.body.classList.toggle('game-over', model.isOver());
  }
  same(a, b) { return a[0] === b[0] && a[1] === b[1]; }
  updateStatus(model) {
    if (model.winner) { const label = model.winner === 'human' ? 'You win' : 'Computer wins'; this.statusTitle.textContent = label; this.statusDetail.textContent = model.mode === 'small' ? 'A winning capture ended the Small Game.' : model.result === 'set' ? 'A full R / S / P set was captured.' : 'One entire piece type was captured.'; this.turnReadout.innerHTML = `<span class="pulse"></span> ${label}`; return; }
    if (model.result === 'stalemate') { this.statusTitle.textContent = 'Draw'; this.statusDetail.textContent = 'The position repeated, no moves remained, or 100 quiet moves passed.'; this.turnReadout.innerHTML = '<span class="pulse"></span> Draw'; return; }
    const humanTurn = model.turn === 'human'; this.statusTitle.textContent = humanTurn ? 'Your move' : 'Computer thinking'; this.statusDetail.textContent = humanTurn ? (model.compoundJump ? 'Continue the jump or end your turn.' : model.selected ? 'Choose a highlighted destination.' : 'Select one of your pieces to see its legal moves.') : 'The computer is weighing the board.'; this.turnReadout.innerHTML = `<span class="pulse"></span> ${humanTurn ? 'Your turn' : 'Computer turn'}`;
  }
}
