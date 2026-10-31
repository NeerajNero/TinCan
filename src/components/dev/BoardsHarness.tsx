"use client";

import { useRef, useState } from "react";

import { BattleshipGrid } from "@/components/play/boards/BattleshipBoard";
import { CheckersBoard } from "@/components/play/boards/CheckersBoard";
import { ChessBoard } from "@/components/play/boards/ChessBoard";
import { ConnectFourBoard } from "@/components/play/boards/ConnectFourBoard";
import { DotsBoard } from "@/components/play/boards/DotsBoard";
import { TicTacToeBoard } from "@/components/play/boards/TicTacToeBoard";
import { CanvasFrame } from "@/components/play/together/CanvasFrame";
import { PixelGrid } from "@/components/play/together/PixelGrid";
import { BS_SIZE, cellIndex } from "@/lib/games/battleship";
import { checkers, type CheckersState } from "@/lib/games/checkers";
import { chess, type ChessState } from "@/lib/games/chess";
import { connectfour, type C4State } from "@/lib/games/connectfour";
import { dots, dotsInitial, type DotsState } from "@/lib/games/dots";
import type { TttState } from "@/lib/games/tictactoe";

const noop = () => undefined;

/**
 * Test-only: every board with a mid-game position, inside the app's column
 * and gutters, so Playwright can measure cells at narrow widths. No Firebase.
 */
export function BoardsHarness() {
  const [ttt] = useState<TttState>({ board: "XO.X.O..." });
  const [c4] = useState<C4State>(() => {
    let s = connectfour.initialState() as C4State;
    for (const col of [3, 3, 2, 4, 2, 1]) s = connectfour.applyMove(s, col) as C4State;
    return s;
  });
  const [ck] = useState<CheckersState>(() => checkers.initialState() as CheckersState);
  const [ch] = useState<ChessState>(() => chess.initialState() as ChessState);
  const [dt] = useState<DotsState>(() => {
    let s = dotsInitial(5);
    s = dots.applyMove(s, { kind: "h", i: 0 });
    s = dots.applyMove(s, { kind: "v", i: 0 });
    s = dots.applyMove(s, { kind: "v", i: 1 });
    s = dots.applyMove(s, { kind: "h", i: 4 });
    return s;
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixel = Array.from({ length: 1024 }, (_, i) => ((i * 7) % 16).toString(16)).join("");
  const shots: Record<number, "hit" | "miss"> = { 0: "hit", 1: "hit", 12: "miss", 45: "miss", 99: "hit" };

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-4">
      <section data-board="tictactoe">
        <TicTacToeBoard state={ttt} canMove legal={[2, 4, 6, 7, 8]} line={[0, 3]} onMove={noop} />
      </section>
      <section data-board="connectfour">
        <ConnectFourBoard state={c4} canMove legal={[0, 1, 2, 3, 4, 5, 6]} onMove={noop} />
      </section>
      <section data-board="checkers">
        <CheckersBoard state={ck} me="first" canMove legal={checkers.legalMoves(ck)} onMove={noop} />
      </section>
      <section data-board="chess">
        <ChessBoard state={ch} me="first" canMove legal={chess.legalMoves(ch)} onMove={noop} />
      </section>
      <section data-board="dots">
        <DotsBoard state={dt} me="first" canMove legal={dots.legalMoves(dt)} names={{ first: "Sam", second: "Priya" }} onMove={noop} />
      </section>
      <section data-board="battleship" className="flex flex-col gap-3">
        <BattleshipGrid
          size="lg"
          label="Their grid"
          cell={(k) => (
            <button key={k} type="button" data-cell aria-label={`cell ${k}`} className="grid min-h-0 min-w-0 place-items-center rounded-md bg-sky-500/15 text-[6cqw] leading-none">
              {shots[k] === "hit" ? "✕" : shots[k] === "miss" ? "•" : ""}
            </button>
          )}
        />
        <BattleshipGrid
          size="sm"
          label="Your grid"
          cell={(k) => (
            <span key={k} data-cell aria-label={`cell ${k}`} className="grid min-h-0 min-w-0 place-items-center rounded-[4px] bg-sky-500/15 text-[6cqw] leading-none">
              {k === cellIndex(2, 2) || k === cellIndex(2, 3) ? "✕" : k % 13 === 0 ? "•" : ""}
            </span>
          )}
        />
        <span className="hidden">{BS_SIZE}</span>
      </section>
      <section data-board="pixel" className="board relative overflow-hidden rounded-[16px] border border-border bg-white shadow-sm [--board-max:400px]">
        <PixelGrid grid={pixel} />
      </section>
      <section data-board="canvas">
        <CanvasFrame wrapRef={wrapRef} canvasRef={canvasRef} onResize={noop} />
      </section>
    </div>
  );
}
