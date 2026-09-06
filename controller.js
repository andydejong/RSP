import { GameModel, HUMAN, COMPUTER } from "./model.js";
import { chooseComputerMove } from "./computer.js";
import { GameView } from "./view.js";

class GameController {
  constructor() {
    this.mode = "small";
    this.firstPlayer = HUMAN;
    this.model = new GameModel(this.mode, this.firstPlayer);
    this.view = new GameView();
    this.computerTimer = null;
    this.view.bindSquareClick((row, col) => this.handleSquare(row, col));
    this.view.bindEndTurn(() => this.endHumanCompoundJump());
    document
      .querySelector("#newGame")
      .addEventListener("click", () => this.restart());
    document.querySelectorAll("[data-mode]").forEach((button) =>
      button.addEventListener("click", () => {
        this.mode = button.dataset.mode;
        this.syncControls();
        this.restart();
      }),
    );
    document.querySelectorAll("[data-first]").forEach((button) =>
      button.addEventListener("click", () => {
        this.firstPlayer = button.dataset.first;
        this.syncControls();
        this.restart();
      }),
    );
    this.render();
    if (this.firstPlayer === COMPUTER) this.queueComputer();
  }
  syncControls() {
    document
      .querySelectorAll("[data-mode]")
      .forEach((button) =>
        button.classList.toggle("active", button.dataset.mode === this.mode),
      );
    document
      .querySelectorAll("[data-first]")
      .forEach((button) =>
        button.classList.toggle(
          "active",
          button.dataset.first === this.firstPlayer,
        ),
      );
  }
  restart() {
    clearTimeout(this.computerTimer);
    this.model = new GameModel(this.mode, this.firstPlayer);
    this.render();
    if (this.firstPlayer === COMPUTER) this.queueComputer();
  }
  render() {
    const legal = this.model.selected
      ? this.model.movesFor(...this.model.selected)
      : [];
    this.view.render(this.model, legal);
  }
  handleSquare(row, col) {
    if (this.model.isOver() || this.model.turn !== HUMAN) return;
    const piece = this.model.board[row][col];
    if (
      this.model.selected &&
      this.model
        .movesFor(...this.model.selected)
        .find((move) => move.to[0] === row && move.to[1] === col)
    ) {
      const move = this.model
        .movesFor(...this.model.selected)
        .find(
          (candidate) => candidate.to[0] === row && candidate.to[1] === col,
        );
      this.model.applyMove(move, { continueJump: move.isJump });
      if (
        this.model.compoundJump &&
        !this.model.movesFor(...this.model.compoundJump.current).length
      )
        this.model.endCompoundTurn();
      this.render();
      if (!this.model.isOver() && !this.model.compoundJump) this.queueComputer();
      return;
    }
    if (this.model.compoundJump) return;
    if (piece?.owner === HUMAN) this.model.pendingComputerCaptures = [];
    this.model.lastComputerMove = null;
    this.model.selected = piece?.owner === HUMAN ? [row, col] : null;
    this.render();
  }
  endHumanCompoundJump() {
    if (this.model.turn !== HUMAN || !this.model.compoundJump) return;
    this.model.endCompoundTurn();
    this.render();
    if (!this.model.isOver()) this.queueComputer();
  }
  queueComputer() {
    this.model.turn = COMPUTER;
    this.render();
    this.computerTimer = setTimeout(() => {
      const move = chooseComputerMove(this.model);
      if (move) this.model.applyMove(move, { computer: true });
      this.render();
    }, 500);
  }
}

new GameController();
