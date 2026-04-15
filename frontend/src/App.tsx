import { useNakama } from "./hooks/useNakama";
import Lobby from "./components/Lobby";
import Matchmaking from "./components/Matchmaking";
import Board from "./components/Board";
import GameOver from "./components/GameOver";

export default function App() {
  const {
    screen, gameState, gameOver,
    myUserId, error, rematchPending,
    joinGame, sendMove, requestRematch, backToLobby
  } = useNakama();

  if (screen === "lobby") {
    return <Lobby onJoin={joinGame} error={error} />;
  }

  if (screen === "matchmaking") {
    return <Matchmaking />;
  }

  if (screen === "game" && gameState) {
    return <Board gameState={gameState} myUserId={myUserId} onMove={sendMove} />;
  }

  if (screen === "gameover" && gameOver) {
    return (
      <GameOver
        gameOver={gameOver}
        myUserId={myUserId}
        rematchPending={rematchPending}
        onRematch={requestRematch}
        onLeave={backToLobby}
      />
    );
  }

  return null;
}