"use strict";

// code msgs between client and server
var OP_CODE_GAME_STATE = 1; // here is the current board
var OP_CODE_MOVE = 2; // ]I want to make a move
var OP_CODE_GAME_OVER = 3; // game has ended
var OP_CODE_REMATCH = 4; // request a rematch
var OP_CODE_REMATCH_RESPONSE = 5; // accept/decline rematch


// check if won
function checkWinner(board) {
    var lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], 
        [0, 3, 6], [1, 4, 7], [2, 5, 8], 
        [0, 4, 8], [2, 4, 6] 
    ];
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var _a = lines_1[_i], a = _a[0], b = _a[1], c = _a[2];
        if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
            return board[a]; 
        }
    }
    return 0;
}
function isBoardFull(board) {
    return board.every(function (cell) { return cell !== 0; });
}


var matchInit = function (ctx, logger, nk, params) {
    var state = {
        board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        marks: {},
        currentTurn: "",
        playerIds: [],
        winner: null,
        status: "waiting",
        rematchRequests: {}
    };
    logger.info("Match created, waiting for players...");
    return {
        state: state,
        tickRate: 1, 
        label: "tictactoe"
    };
};
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    var gameState = state;
    // Reject if match already has 2 players
    if (gameState.playerIds.length >= 2) {
        return { state: gameState, accept: false, rejectMessage: "Match is full" };
    }
    return { state: gameState, accept: true };
};
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    var gameState = state;
    for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
        var presence = presences_1[_i];
        gameState.playerIds.push(presence.userId);
        gameState.marks[presence.userId] = gameState.playerIds.length;
        logger.info("Player joined: " + presence.userId);
    }

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
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    var gameState = state;
    var _loop_1 = function (presence) {
        logger.info("Player left: " + presence.userId);
        if (gameState.status === "playing") {
            gameState.status = "done";
            // Find the player who did NOT leave
            var remaining = gameState.playerIds.find(function (id) { return id !== presence.userId; });
            gameState.winner = remaining || null;
            dispatcher.broadcastMessage(OP_CODE_GAME_OVER, JSON.stringify({
                winner: gameState.winner,
                reason: "opponent_left",
                board: gameState.board
            }), null, null, true);
        }
    };
    for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
        var presence = presences_2[_i];
        _loop_1(presence);
    }
    return { state: gameState };
};
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    var gameState = state;
    var _loop_2 = function (message) {
        var senderId = message.sender.userId;
        // Handle a move
        if (message.opCode === OP_CODE_MOVE) {
            // Ignore moves if game is not in playing state
            if (gameState.status !== "playing")
                return "continue";
            // Ignore if it's not this player's turn
            if (gameState.currentTurn !== senderId) {
                logger.warn("Move rejected: not this player's turn");
                return "continue";
            }
            var data = JSON.parse(nk.binaryToString(message.data));
            var position = data.position;
            // Validate position
            if (position < 0 || position > 8 || gameState.board[position] !== 0) {
                logger.warn("Move rejected: invalid position " + position);
                return "continue";
            }
            // Apply the move
            gameState.board[position] = gameState.marks[senderId];
            // Check for winner
            var winnerMark_1 = checkWinner(gameState.board);
            if (winnerMark_1 !== 0) {
                // Find who has this mark
                var winnerId = Object.keys(gameState.marks).find(function (id) { return gameState.marks[id] === winnerMark_1; }) || null;
                gameState.winner = winnerId;
                gameState.status = "done";
                dispatcher.broadcastMessage(OP_CODE_GAME_OVER, JSON.stringify({
                    winner: gameState.winner,
                    reason: "win",
                    board: gameState.board,
                    marks: gameState.marks
                }), null, null, true);
            }
            else if (isBoardFull(gameState.board)) {
                gameState.winner = "draw";
                gameState.status = "done";
                dispatcher.broadcastMessage(OP_CODE_GAME_OVER, JSON.stringify({
                    winner: "draw",
                    reason: "draw",
                    board: gameState.board,
                    marks: gameState.marks
                }), null, null, true);
            }
            else {
                // Switch turn to the other player
                gameState.currentTurn = gameState.playerIds.find(function (id) { return id !== senderId; }) || senderId;
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
            if (gameState.status !== "done")
                return "continue";
            gameState.rematchRequests[senderId] = true;
            logger.info("Rematch requested by: " + senderId);
            // If both players want rematch, reset the game
            var allWantRematch = gameState.playerIds.every(function (id) { return gameState.rematchRequests[id] === true; });
            if (allWantRematch) {
                // Reset game state
                gameState.board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                gameState.winner = null;
                gameState.status = "playing";
                gameState.rematchRequests = {};
                // Swap who goes first
                gameState.currentTurn = gameState.playerIds[1];
                var temp = gameState.playerIds[0];
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
    };

    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        _loop_2(message);
    }
    // If match is done and no rematch activity, terminate after a while
    if (gameState.status === "done" && tick > 60) {
        return null; 
    }
    return { state: gameState };
};
var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    logger.info("Match terminating");
    return { state: state };
};
var matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state, data: data };
};


// find match
var rpcFindMatch = function (ctx, logger, nk, payload) {
    // Look for an existing match that's waiting for players
    var matches = nk.matchList(10, true, "tictactoe", null, null, "*");
    for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
        var match = matches_1[_i];
        if (match.size < 2) {
            // Found a match with space — return it
            logger.info("Found existing match: " + match.matchId);
            return JSON.stringify({ matchId: match.matchId });
        }
    }

    var matchId = nk.matchCreate("tictactoe", {});
    logger.info("Created new match: " + matchId);
    return JSON.stringify({ matchId: matchId });
};


// save to nakama
var InitModule = function (ctx, logger, nk, initializer) {
    initializer.registerMatch("tictactoe", {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    initializer.registerRpc("find_match", rpcFindMatch);
    logger.info("=== Tic-Tac-Toe server ready! ===");
};

!InitModule && InitModule.bind(null);
