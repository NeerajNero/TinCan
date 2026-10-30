import { describe, expect, it } from "vitest";

import { allSunk, applyShot, battleshipInitial, battleshipMyMove, battleshipStatus, cellIndex, cellsOf, fleetValid, markReady, randomFleet, resolveShot, shipsFit, type Ship } from "@/lib/games/battleship";
import { checkers, type CheckersState } from "@/lib/games/checkers";
import { chess, type ChessState } from "@/lib/games/chess";
import { connectfour, type C4State } from "@/lib/games/connectfour";
import { dots, dotsInitial, dotsScores } from "@/lib/games/dots";
import { applyHangmanGuess, currentRound, hangman, HANGMAN_MAX_WRONG, hangmanInitial, hangmanMover, hangmanSetterFor, hangmanStatus, hangmanWordError, maskWord, normalizeHangmanWord, startHangmanRound, type HangmanState } from "@/lib/games/hangman";
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

describe("dots and boxes", () => {
  const edge = (kind: "h" | "v", i: number) => ({ kind, i });

  it("starts with every edge free and no boxes claimed", () => {
    const s = dotsInitial(5);
    expect(s.h).toHaveLength(5 * 4);
    expect(s.v).toHaveLength(4 * 5);
    expect(s.boxes).toHaveLength(16);
    expect(dots.legalMoves(s)).toHaveLength(40);
    expect(dotsInitial(9).size).toBe(5); // unknown sizes fall back
    expect(dotsInitial(6).boxes).toHaveLength(25);
  });

  it("hands the turn over after a plain line, keeps it after closing a box, and scores it", () => {
    let s = dotsInitial(5);
    // Box (0,0): top h0, bottom h4, left v0, right v1.
    s = dots.applyMove(s, edge("h", 0));
    expect(s.turn).toBe("second");
    s = dots.applyMove(s, edge("h", 4));
    expect(s.turn).toBe("first");
    s = dots.applyMove(s, edge("v", 0));
    expect(s.turn).toBe("second");
    expect(s.boxes[0]).toBe(".");
    s = dots.applyMove(s, edge("v", 1)); // second closes it
    expect(s.boxes[0]).toBe("B");
    expect(s.turn).toBe("second"); // extra turn
    expect(dotsScores(s)).toEqual({ first: 0, second: 1 });
    expect(s.last).toEqual(edge("v", 1));
    expect(dots.legalMoves(s).some((m) => m.kind === "v" && m.i === 1)).toBe(false);
  });

  it("can claim two boxes with one shared edge", () => {
    let s = dotsInitial(5);
    // Boxes (0,0) and (0,1) share v1. Fill everything else around both.
    for (const m of [edge("h", 0), edge("h", 4), edge("v", 0), edge("h", 1), edge("h", 5), edge("v", 2)]) s = dots.applyMove(s, m);
    const mover = s.turn;
    s = dots.applyMove(s, edge("v", 1));
    expect(s.boxes.slice(0, 2)).toBe(mover === "first" ? "AA" : "BB");
    expect(s.turn).toBe(mover);
  });

  it("ends when every box is taken, most boxes wins, equal is a draw", () => {
    const full = { ...dotsInitial(5), h: "#".repeat(20), v: "#".repeat(20) };
    expect(dots.status({ ...full, boxes: "A".repeat(9) + "B".repeat(7) })).toEqual({ status: "win", winner: "first" });
    expect(dots.status({ ...full, boxes: "A".repeat(8) + "B".repeat(8) })).toEqual({ status: "draw" });
    expect(dots.status({ ...full, boxes: "A".repeat(15) + "." })).toEqual({ status: "ongoing" });
    expect(dots.legalMoves({ ...full, boxes: "A".repeat(16) })).toEqual([]);
  });
});

describe("hangman", () => {
  it("masks letters but keeps spaces, revealing guessed letters", () => {
    expect(maskWord("ice cream", "")).toBe("___ _____");
    expect(maskWord("ice cream", "ce")).toBe("_ce c_e__");
    expect(maskWord("apple", "aple")).toBe("apple");
  });

  it("validates custom words: letters and spaces, 1–20 chars", () => {
    expect(hangmanWordError(normalizeHangmanWord("  Ice   Cream "))).toBeNull();
    expect(normalizeHangmanWord("  Ice   Cream ")).toBe("ice cream");
    expect(hangmanWordError("")).toMatch(/type/i);
    expect(hangmanWordError("a".repeat(21))).toMatch(/20/);
    expect(hangmanWordError("don't")).toMatch(/letters/i);
    expect(hangmanWordError(" ab")).toMatch(/letters/i);
  });

  it("alternates the setter and does not accept guesses before the word is set", () => {
    expect(hangmanSetterFor(0)).toBe("first");
    expect(hangmanSetterFor(1)).toBe("second");
    expect(hangmanSetterFor(2)).toBe("first");
    const s0 = hangmanInitial();
    expect(hangmanMover(s0)).toBe("first");
    expect(applyHangmanGuess(s0, "a", "apple")).toBe(s0);
    const s1 = startHangmanRound(s0, "apple");
    expect(s1.phase).toBe("guessing");
    expect(currentRound(s1).mask).toBe("_____");
    expect(hangmanMover(s1)).toBe("second");
    expect(hangman.legalMoves(s1)).toEqual([]);
  });

  it("guesser wins a round by completing the word and gets the point", () => {
    let s = startHangmanRound(hangmanInitial(), "apple");
    for (const l of "zaple") s = applyHangmanGuess(s, l, "apple");
    expect(s.scores).toEqual({ first: 0, second: 1 });
    expect(s.rounds[0]).toMatchObject({ result: "won", word: "apple", wrong: 1, mask: "apple" });
    expect(s.round).toBe(1);
    expect(s.phase).toBe("setting");
    expect(currentRound(s).setter).toBe("second");
    expect(hangmanMover(s)).toBe("second");
    expect(hangmanStatus(s).status).toBe("ongoing");
  });

  it("six misses lose the round to the setter; a repeated letter is ignored", () => {
    let s = startHangmanRound(hangmanInitial(), "apple");
    s = applyHangmanGuess(s, "z", "apple");
    expect(applyHangmanGuess(s, "z", "apple")).toBe(s);
    for (const l of "qwrty") s = applyHangmanGuess(s, l, "apple");
    expect(s.rounds[0]).toMatchObject({ result: "lost", wrong: HANGMAN_MAX_WRONG, word: "apple" });
    expect(s.scores).toEqual({ first: 1, second: 0 });
  });

  it("finishes at two points, or after three rounds", () => {
    const winRound = (s: HangmanState, word: string) => {
      let n = startHangmanRound(s, word);
      for (const l of new Set(word.replace(" ", ""))) n = applyHangmanGuess(n, l, word);
      return n;
    };
    // Round 1: second guesses first's word → second 1. Round 2: first guesses second's word → 1–1. Round 3: second guesses → 1–2.
    let s = winRound(hangmanInitial(), "apple");
    s = winRound(s, "mango");
    expect(s.scores).toEqual({ first: 1, second: 1 });
    expect(s.phase).toBe("setting");
    s = winRound(s, "ice cream");
    expect(s.phase).toBe("done");
    expect(hangmanStatus(s)).toEqual({ status: "win", winner: "second" });
    // Straight 2–0 for the guesser-then-setter: second wins round 1, then holds the word in round 2.
    let t = winRound(hangmanInitial(), "apple");
    t = startHangmanRound(t, "zebra");
    for (const l of "qwxyjk") t = applyHangmanGuess(t, l, "zebra");
    expect(t.phase).toBe("done");
    expect(t.scores).toEqual({ first: 0, second: 2 });
    expect(hangmanStatus(t)).toEqual({ status: "win", winner: "second" });
  });
});

describe("battleship", () => {
  const fleet: Ship[] = [
    { r: 0, c: 0, len: 5, dir: "h" },
    { r: 2, c: 0, len: 4, dir: "v" },
    { r: 2, c: 2, len: 3, dir: "h" },
    { r: 4, c: 4, len: 3, dir: "v" },
    { r: 9, c: 8, len: 2, dir: "h" },
  ];

  it("accepts a legal fleet and rejects overlaps, out-of-bounds ships and wrong lengths", () => {
    expect(fleetValid(fleet)).toBe(true);
    expect(fleetValid([...fleet.slice(0, 4), { r: 2, c: 3, len: 2, dir: "v" }])).toBe(false); // overlaps the cruiser
    expect(fleetValid([...fleet.slice(0, 4), { r: 9, c: 9, len: 2, dir: "h" }])).toBe(false); // off the right edge
    expect(fleetValid([...fleet.slice(0, 4), { r: 9, c: 9, len: 2, dir: "v" }])).toBe(false); // off the bottom
    expect(fleetValid(fleet.slice(0, 4))).toBe(false);
    expect(fleetValid([...fleet.slice(0, 4), { r: 9, c: 0, len: 3, dir: "h" }])).toBe(false);
    expect(shipsFit([fleet[0]!, { r: 1, c: 1, len: 2, dir: "h" }])).toBe(true);
  });

  it("random fleets are always legal", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 25; i++) expect(fleetValid(randomFleet(rand))).toBe(true);
    expect(fleetValid(randomFleet())).toBe(true);
  });

  it("resolves miss, hit and sunk", () => {
    expect(resolveShot(fleet, {}, cellIndex(5, 5)).result).toBe("miss");
    expect(resolveShot(fleet, {}, cellIndex(9, 8)).result).toBe("hit");
    expect(resolveShot(fleet, { [cellIndex(9, 8)]: "hit" }, cellIndex(9, 9))).toMatchObject({ result: "sunk", ship: fleet[4] });
    expect(allSunk(fleet, {})).toBe(false);
  });

  it("readiness flips the turn, both ready starts firing with the inviter", () => {
    const s0 = battleshipInitial();
    expect(battleshipMyMove(s0, "first")).toBe(true);
    expect(battleshipMyMove(s0, "second")).toBe(true);
    const s1 = markReady(s0, "second");
    expect(s1).toMatchObject({ phase: "placing", turn: "first", ready: { first: false, second: true } });
    expect(battleshipMyMove(s1, "second")).toBe(false);
    expect(markReady(s1, "second")).toBe(s1);
    const s2 = markReady(s1, "first");
    expect(s2).toMatchObject({ phase: "firing", turn: "first" });
    expect(battleshipMyMove(s2, "first")).toBe(true);
    expect(battleshipMyMove(s2, "second")).toBe(false);
  });

  it("shots alternate, record hits and misses, announce sunk ships and end the game", () => {
    let s = markReady(markReady(battleshipInitial(), "first"), "second");
    expect(applyShot(s, "second", 0, fleet).result).toBeNull(); // not their turn
    expect(applyShot(s, "first", -1, fleet).result).toBeNull();
    let r = applyShot(s, "first", cellIndex(5, 5), fleet); // first fires at second's fleet
    expect(r.result).toBe("miss");
    s = r.state;
    expect(s.turn).toBe("second");
    expect(s.shots.first[cellIndex(5, 5)]).toBe("miss");
    expect(applyShot(s, "first", 1, fleet).result).toBeNull();
    s = applyShot(s, "second", 50, fleet).state; // any cell, back to first
    r = applyShot(s, "first", cellIndex(9, 8), fleet);
    expect(r.result).toBe("hit");
    s = applyShot(r.state, "second", 51, fleet).state;
    expect(applyShot(s, "first", cellIndex(9, 8), fleet).result).toBeNull(); // already shot
    r = applyShot(s, "first", cellIndex(9, 9), fleet);
    expect(r.result).toBe("sunk");
    expect(r.state.sunk.second).toEqual([{ len: 2, cells: [cellIndex(9, 8), cellIndex(9, 9)] }]);
    expect(r.state.last).toEqual({ by: "first", cell: cellIndex(9, 9), result: "sunk", len: 2 });
    // Sink everything else: first keeps shooting with second passing on empty cells.
    s = r.state;
    let filler = 60;
    for (const ship of fleet.slice(0, 4)) {
      for (const cell of cellsOf(ship)) {
        if (s.turn === "second") s = applyShot(s, "second", filler++, fleet).state;
        s = applyShot(s, "first", cell, fleet).state;
      }
    }
    expect(s.phase).toBe("done");
    expect(s.turn).toBe("first");
    expect(battleshipStatus(s)).toEqual({ status: "win", winner: "first" });
    expect(allSunk(fleet, s.shots.first)).toBe(true);
  });
});
