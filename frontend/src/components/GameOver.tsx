import type { GameOver as GameOverType } from "../hooks/useNakama";

interface Props {
  gameOver: GameOverType;
  myUserId: string;
  rematchPending: boolean;
  onRematch: () => void;
  onLeave: () => void;
}

export default function GameOver({ gameOver, myUserId, rematchPending, onRematch, onLeave }: Props) {
  const { winner, reason, board, marks } = gameOver;

  const isDraw = winner === "draw";
  const iWon  = winner === myUserId;
  const markSymbol = (val: number) => val === 1 ? "X" : "O";
  const markColor  = (val: number) => val === 1 ? "text-indigo-400" : "text-rose-400";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Result */}
        <div className="text-center mb-8">
          {isDraw ? (
            <>
              <div className="text-6xl mb-3">🤝</div>
              <h2 className="text-3xl font-black text-white">It's a Draw!</h2>
              <p className="text-gray-500 text-sm mt-1">Nobody wins this time</p>
            </>
          ) : iWon ? (
            <>
              <div className="text-6xl mb-3">🏆</div>
              <h2 className="text-3xl font-black text-white">You Won!</h2>
              <p className="text-gray-500 text-sm mt-1">
                {reason === "opponent_left" ? "Opponent disconnected" : "Well played!"}
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-3">😔</div>
              <h2 className="text-3xl font-black text-white">You Lost</h2>
              <p className="text-gray-500 text-sm mt-1">
                {reason === "opponent_left" ? "Opponent disconnected" : "Better luck next time!"}
              </p>
            </>
          )}
        </div>

        {/* Mini board replay */}
        <div className="grid grid-cols-3 gap-2 bg-gray-900 p-3 rounded-2xl border border-gray-800 mb-6">
          {board.map((cell, i) => (
            <div key={i}
              className="aspect-square rounded-lg bg-gray-800 flex items-center justify-center text-2xl font-black"
            >
              {cell !== 0 && (
                <span className={markColor(cell)}>{markSymbol(cell)}</span>
              )}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={onRematch}
            disabled={rematchPending}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 
                       disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition text-sm"
          >
            {rematchPending ? "Waiting for opponent..." : "Request Rematch"}
          </button>
          <button
            onClick={onLeave}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 
                       font-bold py-3 rounded-xl transition text-sm"
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
}