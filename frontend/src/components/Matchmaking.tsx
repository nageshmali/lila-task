export default function Matchmaking() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent 
                        rounded-full animate-spin mx-auto mb-6" />
        <h2 className="text-white text-xl font-bold">Finding a match...</h2>
        <p className="text-gray-500 text-sm mt-2">Waiting for another player to join</p>
      </div>
    </div>
  );
}
