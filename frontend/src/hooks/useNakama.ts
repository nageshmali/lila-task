import { useState, useRef } from "react";
import { Client, Session} from "@heroiclabs/nakama-js";
import type { Socket } from "@heroiclabs/nakama-js";

const OP_CODE_GAME_STATE = 1;
const OP_CODE_MOVE       = 2;
const OP_CODE_GAME_OVER  = 3;
const OP_CODE_REMATCH    = 4;

export interface GameState {
  board: number[];
  marks: { [userId: string]: number };
  currentTurn: string;
  status: "waiting" | "playing" | "done";
  winner: string | null;
  rematch?: boolean;
}

export interface GameOver {
  winner: string | null;
  reason: string;
  board: number[];
  marks: { [userId: string]: number };
}

export type Screen = "lobby" | "matchmaking" | "game" | "gameover";

export function useNakama() {
  const clientRef  = useRef<Client | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const socketRef  = useRef<Socket | null>(null);
  const matchIdRef = useRef<string | null>(null);

  const [screen, setScreen]               = useState<Screen>("lobby");
  const [gameState, setGameState]         = useState<GameState | null>(null);
  const [gameOver, setGameOver]           = useState<GameOver | null>(null);
  const [myUserId, setMyUserId]           = useState<string>("");
  const [error, setError]                 = useState<string>("");
  const [rematchPending, setRematchPending] = useState(false);

  async function joinGame(nickname: string) {
    try {
      setError("");

      // Create Nakama client
      const client = new Client("defaultkey", "127.0.0.1", "7350", false);
      clientRef.current = client;

      // Authenticate — creates account if it doesn't exist
      const deviceId = "device-" + nickname + "-" + Math.random().toString(36).substring(2, 8);
      const session = await client.authenticateDevice(deviceId, true, nickname);
      sessionRef.current = session;
      setMyUserId(session.user_id ?? "");

      // Open WebSocket connection
      const socket = client.createSocket(false, false);
      socketRef.current = socket;
      await socket.connect(session, true);

      // Listen for real-time match messages
      socket.onmatchdata = (matchData) => {
        const raw = new TextDecoder().decode(matchData.data as Uint8Array);
        const data = JSON.parse(raw);

        if (matchData.op_code === OP_CODE_GAME_STATE) {
          setGameState(data as GameState);
          if ((data as GameState).rematch) {
            setRematchPending(false);
            setGameOver(null);
            setScreen("game");
          } else if ((data as GameState).status === "playing") {
            setScreen("game");
          }
        }

        if (matchData.op_code === OP_CODE_GAME_OVER) {
          const go = data as GameOver;
          setGameOver(go);
          setGameState(prev =>
            prev ? { ...prev, board: go.board, status: "done" } : null
          );
          setScreen("gameover");
        }
      };

      // Show matchmaking spinner
      setScreen("matchmaking");

      // Ask server to find or create a match
      const result = await client.rpc(session, "find_match", {});
      if (!result.payload) throw new Error("No payload returned from find_match RPC");
      const payload = result.payload as unknown as { matchId: string };
      const foundMatchId = payload.matchId

      // Join the match room
      await socket.joinMatch(foundMatchId);
      matchIdRef.current = foundMatchId;

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError("Connection failed: " + msg);
      setScreen("lobby");
    }
  }

  function sendMove(position: number) {
    if (!socketRef.current || !matchIdRef.current) return;
    const data = new TextEncoder().encode(JSON.stringify({ position }));
    socketRef.current.sendMatchState(matchIdRef.current, OP_CODE_MOVE, data);
  }

  function requestRematch() {
    if (!socketRef.current || !matchIdRef.current) return;
    setRematchPending(true);
    const data = new TextEncoder().encode("{}");
    socketRef.current.sendMatchState(matchIdRef.current, OP_CODE_REMATCH, data);
  }

  function backToLobby() {
    socketRef.current?.disconnect(true);
    socketRef.current  = null;
    clientRef.current  = null;
    sessionRef.current = null;
    matchIdRef.current = null;
    setScreen("lobby");
    setGameState(null);
    setGameOver(null);
    setRematchPending(false);
    setError("");
  }

  return {
    screen,
    gameState,
    gameOver,
    myUserId,
    error,
    rematchPending,
    joinGame,
    sendMove,
    requestRematch,
    backToLobby,
  };
}