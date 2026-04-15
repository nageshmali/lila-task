import type { GameState } from "../hooks/useNakama";

interface Props {
  gameState: GameState;
  myUserId: string;
  onMove: (position: number) => void;
}

const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function getWinningCells(board: number[]): number[] {
  for (const [a,b,c] of WINNING_LINES) {
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return [a,b,c];
    }
  }
  return [];
}

export default function Board({ gameState, myUserId, onMove }: Props) {
  const { board, marks, currentTurn, status } = gameState;
  const myMark = marks[myUserId];
  const isMyTurn = currentTurn === myUserId && status === "playing";
  const winningCells = getWinningCells(board);

  const markSymbol = (val: number) => val === 1 ? "X" : val === 2 ? "O" : null;
  const markColor  = (val: number) => val === 1 ? "text-indigo-400" : "text-rose-400";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white tracking-tight">
            TIC <span className="text-indigo-400">TAC</span> TOE
          </h1>
          <div className="mt-3">
            {status === "playing" ? (
              isMyTurn ? (
                <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                  Your turn — you are {markSymbol(myMark)}
                </span>
              ) : (
                <span className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">
                  Waiting for opponent...
                </span>
              )
            ) : (
              <span className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">
                Waiting for opponent to join...
              </span>
            )}
          </div>
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-3 bg-gray-900 p-4 rounded-2xl border border-gray-800">
          {board.map((cell, i) => {
            const isWinCell = winningCells.includes(i);
            const canClick = isMyTurn && cell === 0;

            return (
              <button
                key={i}
                onClick={() => canClick && onMove(i)}
                className={`
                  aspect-square rounded-xl text-4xl font-black flex items-center justify-center
                  transition-all duration-150
                  ${cell === 0
                    ? canClick
                      ? "bg-gray-800 hover:bg-gray-700 cursor-pointer"
                      : "bg-gray-800 cursor-default"
                    : isWinCell
                      ? "bg-gray-700 scale-105"
                      : "bg-gray-800"
                  }
                `}
              >
                {cell !== 0 && (
                  <span className={`${markColor(cell)} ${isWinCell ? "drop-shadow-lg" : ""}`}>
                    {markSymbol(cell)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* You are */}
        <p className="text-center text-gray-600 text-xs mt-4">
          You are playing as{" "}
          <span className={myMark === 1 ? "text-indigo-400 font-bold" : "text-rose-400 font-bold"}>
            {markSymbol(myMark)}
          </span>
        </p>
      </div>
    </div>
  );
}