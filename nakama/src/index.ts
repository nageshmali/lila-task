// code msgs between client and server
const OP_CODE_GAME_STATE = 1;  // here is the current board
const OP_CODE_MOVE       = 2;  // I want to make a move
const OP_CODE_GAME_OVER  = 3;  // game has ended
const OP_CODE_REMATCH    = 4;  // request a rematch
const OP_CODE_REMATCH_RESPONSE = 5; // accept/decline rematch


interface GameState {
    board: number[];           // 9 cells: 0=empty, 1=X, 2=O
    marks: {[userId: string]: number}; // which mark each player has (1 or 2)
    currentTurn: string;       // userId of who should move next
    playerIds: string[];       // both player userIds
    winner: string | null;     // userId of winner, or "draw", or null
    status: "waiting" | "playing" | "done";
    rematchRequests: {[userId: string]: boolean};
}


function checkWinner(board: number[]): number {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8], // rows
        [0,3,6], [1,4,7], [2,5,8], // columns
        [0,4,8], [2,4,6]            // diagonals
    ];
    for (const [a,b,c] of lines) {
        if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
            return board[a]; // returns 1 or 2
        }
    }
    return 0;
}

function isBoardFull(board: number[]): boolean {
    return board.every(cell => cell !== 0);
}

const matchInit: nkruntime.MatchInitFunction = function(
    ctx, logger, nk, params
) {
    const state: GameState = {
        board: [0,0,0, 0,0,0, 0,0,0],
        marks: {},
        currentTurn: "",
        playerIds: [],
        winner: null,
        status: "waiting",
        rematchRequests: {}
    };

    logger.info("Match created, waiting for players...");

    return {
        state,
        tickRate: 1,      // matchLoop runs once per second
        label: "tictactoe"
    };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function(
    ctx, logger, nk, dispatcher, tick, state, presence, metadata
) {
    const gameState = state as GameState;

    // Reject if match already has 2 players
    if (gameState.playerIds.length >= 2) {
        return { state: gameState, accept: false, rejectMessage: "Match is full" };
    }

    return { state: gameState, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction = function(
    ctx, logger, nk, dispatcher, tick, state, presences
) {
    const gameState = state as GameState;

    for (const presence of presences) {
        gameState.playerIds.push(presence.userId);
        // First player gets mark 1 (X), second gets mark 2 (O)
        gameState.marks[presence.userId] = gameState.playerIds.length;
        logger.info("Player joined: " + presence.userId);
    }

    // Once we have 2 players, start the game
    if (gameState.playerIds.length === 2) {
        gameState.status = "playing";
        gameState.currentTurn = gameState.playerIds[0]; // first player goes first
        logger.info("Both players joined — game starting!");

        // Tell both players the game has started with initial state
        dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify({
            board: gameState.board,
            marks: gameState.marks,
            currentTurn: gameState.currentTurn,
            status: gameState.status,
            winner: null
        }), null, null, true);
    }

    return { state: gameState };
};

const matchLeave: nkruntime.MatchLeaveFunction = function(
    ctx, logger, nk, dispatcher, tick, state, presences
) {
    const gameState = state as GameState;

    for (const presence of presences) {
        logger.info("Player left: " + presence.userId);
        // If someone leaves mid-game, the other player wins
        if (gameState.status === "playing") {
            gameState.status = "done";
            // Find the player who did NOT leave
            const remaining = gameState.playerIds.find(id => id !== presence.userId);
            gameState.winner = remaining || null;

            dispatcher.broadcastMessage(OP_CODE_GAME_OVER, JSON.stringify({
                winner: gameState.winner,
                reason: "opponent_left",
                board: gameState.board
            }), null, null, true);
        }
    }

    return { state: gameState };
};

const matchLoop: nkruntime.MatchLoopFunction = function(
    ctx, logger, nk, dispatcher, tick, state, messages
) {
    const gameState = state as GameState;

    // Process any incoming messages from players
    for (const message of messages) {
        const senderId = message.sender.userId;

        // Handle a move
        if (message.opCode === OP_CODE_MOVE) {
            // Ignore moves if game is not in playing state
            if (gameState.status !== "playing") continue;

            // Ignore if it's not this player's turn
            if (gameState.currentTurn !== senderId) {
                logger.warn("Move rejected: not this player's turn");
                continue;
            }

            const data = JSON.parse(nk.binaryToString(message.data));
            const position: number = data.position;

            // Validate position
            if (position < 0 || position > 8 || gameState.board[position] !== 0) {
                logger.warn("Move rejected: invalid position " + position);
                continue;
            }

            // Apply the move
            gameState.board[position] = gameState.marks[senderId];

            // Check for winner
            const winnerMark = checkWinner(gameState.board);
            if (winnerMark !== 0) {
                // Find who has this mark
                const winnerId = Object.keys(gameState.marks).find(
                    id => gameState.marks[id] === winnerMark
                ) || null;
                gameState.winner = winnerId;
                gameState.status = "done";
                

                dispatcher.broadcastMessage(OP_CODE_GAME_OVER, JSON.stringify({
                    winner: gameState.winner,
                    reason: "win",
                    board: gameState.board,
                    marks: gameState.marks
                }), null, null, true);

            } else if (isBoardFull(gameState.board)) {
                gameState.winner = "draw";
                gameState.status = "done";

                dispatcher.broadcastMessage(OP_CODE_GAME_OVER, JSON.stringify({
                    winner: "draw",
                    reason: "draw",
                    board: gameState.board,
                    marks: gameState.marks
                }), null, null, true);

            } else {
                // Switch turn to the other player
                gameState.currentTurn = gameState.playerIds.find(
                    id => id !== senderId
                ) || senderId;

                // Broadcast updated board to both players
                dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify({
                    board: gameState.board,
                    marks: gameState.marks,
                    currentTurn: gameState.currentTurn,
                    status: gameState.status,
                    winner: null
                }), null, null, true);
            }
        }

        // Handle rematch request
        if (message.opCode === OP_CODE_REMATCH) {
            if (gameState.status !== "done") continue;

            gameState.rematchRequests[senderId] = true;
            logger.info("Rematch requested by: " + senderId);

            // If both players want rematch, reset the game
            const allWantRematch = gameState.playerIds.every(
                id => gameState.rematchRequests[id] === true
            );

            if (allWantRematch) {
                // Reset game state
                gameState.board = [0,0,0, 0,0,0, 0,0,0];
                gameState.winner = null;
                gameState.status = "playing";
                gameState.rematchRequests = {};
                // Swap who goes first
                gameState.currentTurn = gameState.playerIds[1];
                const temp = gameState.playerIds[0];
                gameState.playerIds[0] = gameState.playerIds[1];
                gameState.playerIds[1] = temp;

                dispatcher.broadcastMessage(OP_CODE_GAME_STATE, JSON.stringify({
                    board: gameState.board,
                    marks: gameState.marks,
                    currentTurn: gameState.currentTurn,
                    status: gameState.status,
                    winner: null,
                    rematch: true
                }), null, null, true);
            }
        }
    }

    // If match is done and no rematch activity, terminate after a while
    if (gameState.status === "done" && tick > 60) {
        return null; // returning null ends the match
    }

    return { state: gameState };
};

const matchTerminate: nkruntime.MatchTerminateFunction = function(
    ctx, logger, nk, dispatcher, tick, state, graceSeconds
) {
    logger.info("Match terminating");
    return { state };
};

const matchSignal: nkruntime.MatchSignalFunction = function(
    ctx, logger, nk, dispatcher, tick, state, data
) {
    return { state, data };
};

// find match
const rpcFindMatch: nkruntime.RpcFunction = function(
    ctx, logger, nk, payload
) {
    // Look for an existing match that's waiting for players
    const matches = nk.matchList(10, true, "tictactoe", null, null, "*");

    for (const match of matches) {
        if (match.size < 2) {
            // Found a match with space — return it
            logger.info("Found existing match: " + match.matchId);
            return JSON.stringify({ matchId: match.matchId });
        }
    }

    // No available match found — create a new one
    const matchId = nk.matchCreate("tictactoe", {});
    logger.info("Created new match: " + matchId);
    return JSON.stringify({ matchId });
};

// save to nakama
const InitModule: nkruntime.InitModule = function(
    ctx, logger, nk, initializer
) {
    initializer.registerMatch("tictactoe", {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });

    initializer.registerRpc("find_match", rpcFindMatch);

    logger.info("=== Tic-Tac-Toe server ready! ===");
};

!InitModule && InitModule.bind(null);