import { useState } from "react";

interface Props {
  onJoin: (nickname: string) => void;
  error: string;
}

export default function Lobby({ onJoin, error }: Props) {
  const [nickname, setNickname] = useState("");

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white tracking-tight">
            TIC <span className="text-indigo-400">TAC</span> TOE
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Multiplayer · Real-time</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <label className="block text-gray-400 text-xs uppercase tracking-widest mb-2">
            Your Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === "Enter" && nickname.trim() && onJoin(nickname.trim())}
            placeholder="e.g. CoolPlayer99"
            maxLength={20}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 
                       outline-none border border-gray-700 focus:border-indigo-500 
                       transition placeholder-gray-600 text-sm"
          />

          {error && (
            <p className="text-red-400 text-xs mt-2">{error}</p>
          )}

          <button
            onClick={() => nickname.trim() && onJoin(nickname.trim())}
            disabled={!nickname.trim()}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700
                       disabled:text-gray-500 text-white font-bold py-3 rounded-xl 
                       transition text-sm tracking-wide"
          >
            Find a Match
          </button>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Opens a new tab? Open this in two browsers to test multiplayer.
        </p>
      </div>
    </div>
  );
}