import { describe, expect, it } from "vitest";

import { checkers, type CheckersState } from "@/lib/games/checkers";
import { chess, type ChessState } from "@/lib/games/chess";
import { connectfour, type C4State } from "@/lib/games/connectfour";
import { tictactoe } from "@/lib/games/tictactoe";

/** 8×8 board from eight rows of text (row 0 at the top). */
const board = (...rows: string[]) => rows.join("");
const empty = "........";

describe("checkers", () => {
  it("makes a capture mandatory when one is available", () => {
    // first ('r') at (5,2) can step or jump over 'b' at (4,3) to (3,4).
    const state: CheckersState = {
      board: board(empty, empty, empty, empty, "...b....", "..r.....", empty, empty),
      turn: "first",
      quiet: 0,
    };
    const moves = checkers.legalMoves(state);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toEqual({ path: [5 * 8 + 2, 3 * 8 + 4], captures: [4 * 8 + 3] });
  });

  it("chains a multi-jump and removes every captured piece", () => {
    // r at (6,1); b at (5,2) and (3,4): jump to (4,3) then to (2,5).
    const state: CheckersState = {
      board: board(empty, empty, empty, "....b...", empty, "..b.....", ".r......", empty),
      turn: "first",
      quiet: 0,
    };
    const moves = checkers.legalMoves(state);
    expect(moves).toHaveLength(1);
    const move = moves[0]!;
    expect(move.path).toEqual([6 * 8 + 1, 4 * 8 + 3, 2 * 8 + 5]);
    expect(move.captures).toEqual([5 * 8 + 2, 3 * 8 + 4]);
    const next = checkers.applyMove(state, move);
    expect(next.board.match(/b/g)).toBeNull();
    expect(next.board[2 * 8 + 5]).toBe("r");
    expect(next.turn).toBe("second");
    expect(next.quiet).toBe(0);
  });

  it("crowns on the far row and ends the move there", () => {
    const state: CheckersState = { board: board(empty, "..r.....", empty, empty, empty, empty, empty, "......b."), turn: "first", quiet: 3 };
    const move = checkers.legalMoves(state).find((m) => m.path[1] === 1)!;
    const next = checkers.applyMove(state, move);
    expect(next.board[1]).toBe("R");
    expect(next.quiet).toBe(0);
  });

  it("declares a win when the opponent has no pieces", () => {
    const state: CheckersState = { board: board(empty, empty, empty, empty, empty, "..r.....", empty, empty), turn: "second", quiet: 0 };
    expect(checkers.status(state)).toEqual({ status: "win", winner: "first" });
  });
});

describe("chess", () => {
  it("promotes a pawn (queen by default, or the piece asked for)", () => {
    const state: ChessState = { fen: "8/P6k/8/8/8/8/8/K7 w - - 0 1", history: [], lastMove: null };
    const promo = chess.legalMoves(state).filter((m) => m.from === "a7" && m.to === "a8");
    expect(promo.map((m) => m.promotion).sort()).toEqual(["b", "n", "q", "r"]);
    const queen = chess.applyMove(state, { from: "a7", to: "a8" });
    expect(queen.fen.startsWith("Q7/7k")).toBe(true);
    const knight = chess.applyMove(state, { from: "a7", to: "a8", promotion: "n" });
    expect(knight.fen.startsWith("N7/7k")).toBe(true);
    expect(knight.history).toEqual(["a8=N"]);
  });

  it("detects checkmate and credits the right side", () => {
    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    let state = chess.initialState();
    for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]] as const) state = chess.applyMove(state, { from, to });
    expect(chess.status(state)).toEqual({ status: "win", winner: "second" });
    expect(chess.legalMoves(state)).toHaveLength(0);
  });

  it("recognises stalemate as a draw", () => {
    const state: ChessState = { fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", history: [], lastMove: null };
    expect(chess.status(state).status).toBe("draw");
  });
});

describe("connect four", () => {
  it("finds a diagonal win and reports the line", () => {
    // Columns 0..3 stacked so R sits on the rising diagonal (5,0) (4,1) (3,2) (2,3).
    let state: C4State = connectfour.initialState();
    const drops = [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]; // R: 0,1,2,2,3,3 … ends with R at (2,3)
    for (const col of drops) state = connectfour.applyMove(state, col);
    const result = connectfour.status(state);
    expect(result.status).toBe("win");
    expect(result.winner).toBe("first");
    expect(result.line).toEqual([2 * 7 + 3, 3 * 7 + 2, 4 * 7 + 1, 5 * 7 + 0]);
  });

  it("refuses a full column and calls a full board a draw", () => {
    let state: C4State = connectfour.initialState();
    for (let i = 0; i < 6; i++) state = connectfour.applyMove(state, 0);
    expect(connectfour.legalMoves(state)).not.toContain(0);
    const full: C4State = { board: "RRRYYYRYYYRRRYRRRYYYRYYYRRRYRRRYYYRYYYRRRY", last: null };
    expect(connectfour.status(full).status).toBe("draw");
  });
});

describe("tic-tac-toe", () => {
  it("spots a row win with the winning line", () => {
    let state = tictactoe.initialState();
    for (const i of [0, 3, 1, 4, 2]) state = tictactoe.applyMove(state, i);
    expect(tictactoe.status(state)).toEqual({ status: "win", winner: "first", line: [0, 1, 2] });
  });
});
