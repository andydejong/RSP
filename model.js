// The model owns every rule and never depends on the DOM.
export const HUMAN = "human";
export const COMPUTER = "computer";
export const TYPES = ["rock", "scissors", "paper"];
const DIRECTIONS = [-1, 1];
const DELTAS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export class GameModel {
  constructor(mode = "small", firstPlayer = HUMAN) {
    this.reset(mode, firstPlayer);
  }

  reset(mode = this.mode, firstPlayer = this.firstPlayer) {
    this.mode = mode;
    this.size = mode === "small" ? 6 : 8;
    this.firstPlayer = firstPlayer;
    this.board = Array.from({ length: this.size }, () =>
      Array(this.size).fill(null),
    );
    this.turn = firstPlayer;
    this.winner = null;
    this.result = null;
    this.selected = null;
    this.compoundJump = null;
    this.lastComputerMove = null;
    this.pendingComputerCaptures = [];
    this.moveNumber = 0;
    this.quietMoves = 0;
    this.positionCounts = new Map();
    this.captured = {
      human: { rock: 0, scissors: 0, paper: 0 },
      computer: { rock: 0, scissors: 0, paper: 0 },
    };
    this.setupPieces();
    this.recordPosition();
  }

  isPlayable(row, col) {
    return (
      row >= 0 &&
      row < this.size &&
      col >= 0 &&
      col < this.size &&
      (row + col) % 2 === 1
    );
  }
  backRow(owner) {
    return owner === COMPUTER ? this.size - 1 : 0;
  }
  makePiece(owner, type) {
    return { owner, type, king: false };
  }
  setupPieces() {
    if (this.mode === "small") {
      let order = [...TYPES].sort(() => Math.random() - 0.5);
      [1, 3, 5].forEach((col, index) => {
        this.board[0][col] = this.makePiece(COMPUTER, order[index]);
      });
      order = [...TYPES].sort(() => Math.random() - 0.5);
      [0, 2, 4].forEach((col, index) => {
        this.board[this.size - 1][col] = this.makePiece(HUMAN, order[index]);
      });
      return;
    }
    const rows = [
      [0, 1, 2],
      [0, 1, 2],
      [1, 2, 3],
    ];
    rows.forEach((cols, rowIndex) =>
      cols.forEach((colIndex, index) => {
        const computerTypes = ["paper", "scissors", "rock"];
        const humanTypes = ["rock", "scissors", "paper"];
        const computerShift = rowIndex === 2 ? -2 : 2;
        const computerCol = 1 - (rowIndex % 2) + colIndex * 2 + computerShift;
        const humanRow = this.size - 1 - rowIndex;
        const humanCol = 1 - (humanRow % 2) + colIndex * 2;
        this.board[rowIndex][computerCol] = this.makePiece(
          COMPUTER,
          computerTypes[index],
        );
        this.board[humanRow][humanCol] = this.makePiece(
          HUMAN,
          humanTypes[index],
        );
      }),
    );
  }

  opponent(owner) {
    return owner === HUMAN ? COMPUTER : HUMAN;
  }
  canCapture(jumper, jumped) {
    if (!jumped || jumped.owner === jumper.owner) return false;
    return (
      (jumper.type === "rock" && ["rock", "scissors"].includes(jumped.type)) ||
      (jumper.type === "scissors" &&
        ["scissors", "paper"].includes(jumped.type)) ||
      (jumper.type === "paper" && ["paper", "rock"].includes(jumped.type))
    );
  }
  directions(piece, row) {
    if (piece.king) return DELTAS;
    const forward = piece.owner === HUMAN ? -1 : 1;
    return DELTAS.filter(([dr]) => dr === forward);
  }
  cloneBoard() {
    return this.board.map((row) =>
      row.map((piece) => (piece ? { ...piece } : null)),
    );
  }
  clone() {
    const copy = Object.create(GameModel.prototype);
    Object.assign(copy, this, {
      board: this.cloneBoard(),
      captured: JSON.parse(JSON.stringify(this.captured)),
      positionCounts: new Map(this.positionCounts),
      compoundJump: this.compoundJump
        ? {
            ...this.compoundJump,
            current: [...this.compoundJump.current],
            visited: new Set(this.compoundJump.visited),
            move: {
              ...this.compoundJump.move,
              from: [...this.compoundJump.move.from],
              steps: this.compoundJump.move.steps.map((step) => ({
                ...step,
                from: [...step.from],
                to: [...step.to],
                jumped: step.jumped ? [...step.jumped] : null,
              })),
            },
          }
        : null,
    });
    return copy;
  }
  serialize() {
    return this.board
      .map((row) =>
        row
          .map((p) =>
            p ? `${p.owner[0]}${p.type[0]}${p.king ? "k" : ""}` : "--",
          )
          .join(","),
      )
      .join("|");
  }
  recordPosition() {
    const key = this.serialize();
    this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
  }

  jumpPositionKey(board, row, col) {
    return `${board
      .map((line) =>
        line
          .map((p) =>
            p ? `${p.owner[0]}${p.type[0]}${p.king ? "k" : ""}` : "--",
          )
          .join(","),
      )
      .join("|")}|moving:${row},${col}`;
  }

  jumpSteps(row, col, board = this.board, visited = null) {
    const piece = board[row]?.[col];
    if (!piece) return [];
    const seen = visited || new Set([this.jumpPositionKey(board, row, col)]);
    return this.directions(piece, row).flatMap(([dr, dc]) => {
      const middleRow = row + dr,
        middleCol = col + dc,
        landRow = row + dr * 2,
        landCol = col + dc * 2;
      if (
        !this.isPlayable(landRow, landCol) ||
        board[landRow][landCol] ||
        !board[middleRow]?.[middleCol]
      )
        return [];
      const jumped = board[middleRow][middleCol];
      if (jumped.owner !== piece.owner && !this.canCapture(piece, jumped))
        return [];
      const nextBoard = board.map((line) =>
        line.map((item) => (item ? { ...item } : null)),
      );
      nextBoard[row][col] = null;
      nextBoard[landRow][landCol] = { ...piece };
      if (jumped.owner !== piece.owner) nextBoard[middleRow][middleCol] = null;
      const becameKing = !piece.king && landRow === this.backRow(piece.owner);
      nextBoard[landRow][landCol].king = piece.king || becameKing;
      const key = this.jumpPositionKey(nextBoard, landRow, landCol);
      if (seen.has(key)) return [];
      return [{
        from: [row, col],
        to: [landRow, landCol],
        jumped: [middleRow, middleCol],
        captured: jumped.owner !== piece.owner,
        becameKing,
        board: nextBoard,
        key,
      }];
    });
  }

  // A jump is recursively expanded into optional compound jumps. Each result is a complete legal turn.
  jumpMoves(row, col, board = this.board, forcedPiece = null, visited = null) {
    const piece = board[row]?.[col];
    if (!piece) return [];
    const seen = visited || new Set([this.jumpPositionKey(board, row, col)]);
    const moves = [];
    this.jumpSteps(row, col, board, seen).forEach((candidate) => {
      const { board: nextBoard, key, becameKing, ...step } = candidate;
      const move = {
        from: [forcedPiece?.[0] ?? row, forcedPiece?.[1] ?? col],
        to: [...step.to],
        steps: [step],
        isJump: true,
      };
      // Reaching the back row ends the turn even if another jump exists.
      if (!becameKing) {
        const continuations = this.jumpMoves(
          step.to[0],
          step.to[1],
          nextBoard,
          forcedPiece || [row, col],
          new Set([...seen, key]),
        );
        if (continuations.length)
          continuations.forEach((next) =>
            moves.push({
              ...next,
              from: move.from,
              steps: [step, ...next.steps],
            }),
          );
      }
      moves.push(move);
    });
    return moves;
  }
  simpleMoves(row, col) {
    const piece = this.board[row]?.[col];
    if (!piece) return [];
    return this.directions(piece, row).flatMap(([dr, dc]) => {
      const to = [row + dr, col + dc];
      return this.isPlayable(...to) && !this.board[to[0]][to[1]]
        ? [
            {
              from: [row, col],
              to,
              steps: [{ from: [row, col], to, jumped: null, captured: false }],
              isJump: false,
            },
          ]
        : [];
    });
  }
  legalMoves(owner = this.turn) {
    const moves = [];
    this.board.forEach((line, row) =>
      line.forEach((piece, col) => {
        if (piece?.owner === owner) {
          moves.push(...this.simpleMoves(row, col));
          moves.push(...this.jumpMoves(row, col));
        }
      }),
    );
    return moves;
  }
  movesFor(row, col) {
    if (this.compoundJump) {
      if (this.compoundJump.current[0] !== row || this.compoundJump.current[1] !== col)
        return [];
      return this.jumpSteps(row, col, this.board, this.compoundJump.visited).map(
        ({ board, key, becameKing, ...step }) => ({
          from: [...step.from],
          to: [...step.to],
          steps: [{ ...step, becameKing }],
          isJump: true,
        }),
      );
    }
    return [
      ...this.simpleMoves(row, col),
      ...this.jumpSteps(row, col).map(({ board, key, becameKing, ...step }) => ({
        from: [...step.from],
        to: [...step.to],
        steps: [{ ...step, becameKing }],
        isJump: true,
      })),
    ];
  }

  // Apply an entire move path, remove opponent pieces, and king at the far row.
  applyMove(move, options = {}) {
    const piece = this.board[move.from[0]][move.from[1]];
    if (!piece) return;
    const startingJumpKey = this.jumpPositionKey(
      this.board,
      move.from[0],
      move.from[1],
    );
    this.board[move.from[0]][move.from[1]] = null;
    let current = { ...piece },
      capturedAny = false,
      capturedPieces = [];
    move.steps.forEach((step) => {
      if (step.captured) {
        const capturedPiece = this.board[step.jumped[0]][step.jumped[1]];
        if (capturedPiece) {
          this.captured[current.owner][capturedPiece.type]++;
          capturedPieces.push({
            at: [...step.jumped],
            piece: { ...capturedPiece },
          });
        }
        this.board[step.jumped[0]][step.jumped[1]] = null;
        capturedAny = true;
      }
    });
    const [row, col] = move.to;
    const becameKing = !current.king && row === this.backRow(current.owner);
    if (becameKing) current.king = true;
    this.board[row][col] = current;
    const continueJump = options.continueJump && move.isJump && !becameKing;
    if (continueJump) {
      const previous = this.compoundJump;
      const visited = previous
        ? new Set(previous.visited)
        : new Set([startingJumpKey]);
      visited.add(this.jumpPositionKey(this.board, row, col));
      this.compoundJump = {
        owner: current.owner,
        current: [row, col],
        visited,
        capturedAny: (previous?.capturedAny || false) || capturedAny,
        capturedPieces: [
          ...(previous?.capturedPieces || []),
          ...capturedPieces,
        ],
        move: previous
          ? {
              ...previous.move,
              to: [row, col],
              steps: [...previous.move.steps, ...move.steps],
            }
          : { ...move, from: [...move.from], to: [row, col], steps: [...move.steps] },
      };
      this.selected = [row, col];
      this.checkEnd(current.owner, capturedAny, move, { finish: false });
      return;
    }
    this.finishTurn(current.owner, capturedAny, move, options, capturedPieces);
  }

  finishTurn(owner, capturedAny, move, options = {}, capturedPieces = []) {
    const compound = this.compoundJump;
    const totalCaptured = (compound?.capturedAny || false) || capturedAny;
    const completedMove = compound
      ? { ...compound.move, to: [...move.to], steps: [...compound.move.steps] }
      : move;
    this.compoundJump = null;
    this.moveNumber++;
    this.quietMoves = totalCaptured ? 0 : this.quietMoves + 1;
    this.selected = null;
    if (options.record !== false) this.recordPosition();
    if (options.computer)
      this.lastComputerMove = {
        from: completedMove.from,
        landed: completedMove.steps.map((step) => step.to),
        jumped: completedMove.steps
          .filter((step) => step.jumped)
          .map((step) => step.jumped),
        to: completedMove.to,
      };
    this.pendingComputerCaptures = options.computer
      ? [...(compound?.capturedPieces || []), ...capturedPieces]
      : [];
    this.checkEnd(owner, totalCaptured, completedMove);
    if (!this.winner && !this.result) this.turn = this.opponent(owner);
  }

  endCompoundTurn() {
    if (!this.compoundJump) return;
    const { owner, current } = this.compoundJump;
    this.finishTurn(owner, this.compoundJump.capturedAny, {
      ...this.compoundJump.move,
      to: [...current],
      steps: [],
      isJump: true,
    });
  }

  checkEnd(owner, capturedAny, move, options = {}) {
    const other = this.opponent(owner);
    if (this.mode === "small" && move.isJump && capturedAny) {
      this.winner = owner;
      this.result = "capture";
      return;
    }
    if (this.mode === "big" && capturedAny) {
      const opponentTypesCaptured = this.captured[owner];
      const allOfOneType = TYPES.some(
        (type) => this.countPieces(other, type) === 0,
      );
      const oneOfEach = TYPES.every((type) => opponentTypesCaptured[type] > 0);
      if (allOfOneType || oneOfEach) {
        this.winner = owner;
        this.result = allOfOneType ? "type" : "set";
        return;
      }
    }
    if (options.finish === false) return;
    if (
      !this.legalMoves(this.turn).length ||
      this.quietMoves >= 100 ||
      [...this.positionCounts.values()].some((count) => count >= 3)
    )
      this.result = "stalemate";
  }
  countPieces(owner, type = null) {
    return this.board
      .flat()
      .filter(
        (piece) => piece?.owner === owner && (!type || piece.type === type),
      ).length;
  }
  isOver() {
    return Boolean(this.winner || this.result);
  }
}
