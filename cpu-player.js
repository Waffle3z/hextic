// CPU Player Logic

// Get all lines of 6 that intersect a given hex (using custom tile map)
function getLinesIntersectingHex(q, r, tiles) {
	const lines = [];
	const checkedWindows = new Set();
	
	for (const dir of window.HEX_DIRECTIONS) {
		const fullLine = buildLineWithTiles(tiles, q, r, dir.q, dir.r);
		
		if (fullLine.length < window.WINNING_LENGTH) continue;
		
		for (let i = 0; i <= fullLine.length - window.WINNING_LENGTH; i++) {
			const hexWindow = fullLine.slice(i, i + window.WINNING_LENGTH);
			
			const containsTarget = hexWindow.some(h => h.q === q && h.r === r);
			if (!containsTarget) continue;
			
			const first = hexWindow[0];
			const last = hexWindow[window.WINNING_LENGTH - 1];
			const lineKey = `${first.q},${first.r}-${last.q},${last.r}`;
			
			if (checkedWindows.has(lineKey)) continue;
			checkedWindows.add(lineKey);
			
			lines.push(hexWindow.map(h => ({ q: h.q, r: h.r })));
		}
	}
	
	return lines;
}

function findWinningMove(cpuPlayer) {
	const movesLeft = getMovesLeftInTurn(cpuPlayer);
	
	const threats = checkThreat();
	const cpuThreats = cpuPlayer === 1 ? threats.player1 : threats.player2;
	
	if (cpuThreats && cpuThreats.length > 0) {
		if (movesLeft >= 2) {
			return findMoveToCompleteThreat(cpuPlayer, cpuThreats);
		} else if (movesLeft === 1) {
			for (const threatLine of cpuThreats) {
				let cpuCount = 0;
				for (const hex of threatLine) {
					const tile = gameState.tiles.get(getHexKey(hex.q, hex.r));
					if (tile === cpuPlayer) cpuCount++;
				}
				if (cpuCount >= 5) {
					return findMoveToCompleteThreat(cpuPlayer, cpuThreats);
				}
			}
		}
	}
	
	return null;
}

function findMoveToCompleteThreat(cpuPlayer, cpuThreats) {
	const candidates = getMoveCandidates(gameState.tiles);
	
	for (const hex of candidates) {
		gameState.tiles.set(getHexKey(hex.q, hex.r), cpuPlayer);
		const winningLine = checkWin(cpuPlayer);
		gameState.tiles.delete(getHexKey(hex.q, hex.r));
		
		if (winningLine) {
			return hex;
		}
	}
	
	for (const threatLine of cpuThreats) {
		for (const hex of threatLine) {
			if (isHexEmpty(hex.q, hex.r)) {
				return { q: hex.q, r: hex.r };
			}
		}
	}
	
	return null;
}

function makeCPUMove() {
	if (gameState.gamePhase === 'gameOver') {
		return false;
	}
	
	if (moveHistoryTree.currentNode && moveHistoryTree.currentNode !== getLatestNode()) {
		rebuildGameState(moveHistoryTree.currentNode);
	}
	
	const cpuPlayer = getCurrentPlayer();
	const movesLeft = getMovesLeftInTurn(cpuPlayer);
	
	if (gameState.gamePhase === 'initial') {
		if (isHexEmpty(0, 0)) {
			return handleTilePlacement(0, 0);
		}
		return false;
	}
	
	const winningMove = findWinningMove(cpuPlayer);
	if (winningMove) {
		return handleTilePlacement(winningMove.q, winningMove.r);
	}
	
	const bestMovePair = findBestMovePair();
	if (bestMovePair && bestMovePair.length > 0) {
		for (let i = movesLeft == 2 ? 0 : 1; i < bestMovePair.length; i++) {
			const move = bestMovePair[i];
			handleTilePlacement(move.q, move.r, i == 0);
		}
		
		return true;
	}
	
	return false;
}

function evaluatePosition(tiles, player) {
	const opponentPlayer = player === 1 ? 2 : 1;
	const allLines = getAllLines(tiles);
	
	let playerScore = 0;
	let opponentScore = 0;
	
	for (const line of allLines) {
		const { player1Count, player2Count, player: linePlayer } = line;
		if (linePlayer === 0) continue;
		
		const pCount = player === 1 ? player1Count : player2Count;
		const oCount = player === 1 ? player2Count : player1Count;
		
		if (linePlayer === player) {
			if (pCount >= 4) playerScore += 0.5;
			else if (pCount === 3) playerScore += 0.3;
			else if (pCount === 2) playerScore += 0.2;
			if (pCount >= 1) playerScore += 0.1;
		}
		
		if (linePlayer === opponentPlayer) {
			if (oCount >= 4) opponentScore += 1000000;
			else if (oCount === 3) { opponentScore += 3; }
			else if (oCount === 2) { opponentScore += 2; }
			if (oCount >= 1) opponentScore += 1;
		}
	}
	
	let isolatedOpponentPenalty = 0;
	for (const [key, cellOwner] of tiles) {
		if (cellOwner !== opponentPlayer) continue;
		
		const [q, r] = key.split(',').map(Number);
		let hasAdjacentPlayer = false;
		
		for (const dir of window.HEX_DIRECTIONS) {
			const neighborKey = getHexKey(q + dir.q, r + dir.r);
			if (tiles.get(neighborKey) === player) {
				hasAdjacentPlayer = true;
				break;
			}
		}
		
		if (!hasAdjacentPlayer) {
			isolatedOpponentPenalty += 3;
		}
	}
	
	return playerScore - opponentScore - isolatedOpponentPenalty;
}

// Check if a hex is inside any of the threat lines
function isHexInThreatLine(hex, threats) {
	if (!threats || threats.length === 0) {
		return false;
	}
	
	for (const threatLine of threats) {
		for (const threatHex of threatLine) {
			if (threatHex.q === hex.q && threatHex.r === hex.r) {
				return true;
			}
		}
	}
	return false;
}

// Get all blocking moves (moves inside opponent threat lines)
function getBlockingMoves(opponentThreats) {
	const candidates = getMoveCandidates(gameState.tiles);
	const blockingMoves = [];
	
	for (const move of candidates) {
		if (isHexInThreatLine(move, opponentThreats)) {
			blockingMoves.push(move);
		}
	}
	
	return blockingMoves;
}

// Find the best move pair according to heuristic positional evaluation
// If first move in turn was already made, first move in pair is forced
// Move pairs are order-agnostic (avoid duplicates where order is reversed)
// Priority: Block opponent threats if they exist
// Get opponent's most recent 2 moves (last 2 tiles placed by opponent)
function getOpponentRecentMoves(opponentPlayer) {
	const moves = [];
	let node = moveHistoryTree.currentNode;
	
	// Traverse back to find opponent's moves
	while (node && moves.length < 2) {
		if (node.player === opponentPlayer) {
			moves.unshift({ q: node.q, r: node.r }); // Add to front to get chronological order
		}
		node = node.parent;
	}
	
	return moves;
}

// Get all candidate hexes: in lines containing opponent's recent moves + blocking moves for threats + preemptive moves
function getRestrictedCandidates(tiles, opponentPlayer, cpuPlayer) {
	const candidates = new Set();
	
	// 1. Get hexes in lines containing opponent's most recent 2 moves
	const recentMoves = getOpponentRecentMoves(opponentPlayer);
	for (const move of recentMoves) {
		const lines = getLinesIntersectingHex(move.q, move.r, tiles);
		for (const line of lines) {
			for (const hex of line) {
				if (!tiles.has(getHexKey(hex.q, hex.r))) {
					candidates.add(getHexKey(hex.q, hex.r));
				}
			}
		}
	}
	
	// 2. Get blocking moves for any existing threats
	const threats = checkThreat();
	const opponentThreats = opponentPlayer === 1 ? threats.player1 : threats.player2;
	if (opponentThreats && opponentThreats.length > 0) {
		const blockingMoves = getBlockingMoves(opponentThreats);
		for (const move of blockingMoves) {
			candidates.add(getHexKey(move.q, move.r));
		}
	}
	
	// 3. Add empty hexes from CPU player's preemptive lines
	const preemptiveLines = getPreemptiveLines(tiles, cpuPlayer);
	for (const line of preemptiveLines) {
		for (const hex of line.hexes) {
			if (!tiles.has(getHexKey(hex.q, hex.r))) {
				candidates.add(getHexKey(hex.q, hex.r));
			}
		}
	}
	
	// Convert Set back to array of hex objects
	const result = [];
	for (const key of candidates) {
		const [q, r] = key.split(',').map(Number);
		result.push({ q, r });
	}
	
	return result;
}

function findBestMovePair() {
	const cpuPlayer = getCurrentPlayer();
	const opponentPlayer = cpuPlayer === 1 ? 2 : 1;
	const forcedFirstMove = getForcedFirstMove(cpuPlayer);
	
	// Use restricted candidate set instead of all possible moves
	let candidates = getRestrictedCandidates(gameState.tiles, opponentPlayer, cpuPlayer);
	
	if (candidates.length === 0) {
		// Fallback to all candidates if restricted set is empty
		candidates = getMoveCandidates(gameState.tiles);
	}
	
	if (candidates.length === 0) {
		return null;
	}
	
	// Check for opponent threats
	const threats = checkThreat();
	const opponentThreats = opponentPlayer === 1 ? threats.player1 : threats.player2;
	const hasOpponentThreats = opponentThreats && opponentThreats.length > 0;
	
	// If there are opponent threats, first move must be a block
	let firstMoveCandidates = candidates;
	if (hasOpponentThreats) {
		const blockingMoves = getBlockingMoves(opponentThreats);
		if (blockingMoves.length > 0) {
			firstMoveCandidates = blockingMoves;
		}
	}
	
	// Always return a pair - if only 1 move left, first is forced
	if (forcedFirstMove) {
		// First move is forced, find best second move
		let bestSecond = null;
		let bestScore = -Infinity;
		
		for (const move of candidates) {
			if (move.q === forcedFirstMove.q && move.r === forcedFirstMove.r) continue;
			
			makeTempMove(gameState.tiles, move.q, move.r, cpuPlayer);
			const score = evaluatePosition(gameState.tiles, cpuPlayer);
			undoTempMove(gameState.tiles, move.q, move.r);
			
			if (score > bestScore) {
				bestScore = score;
				bestSecond = move;
			}
		}
		
		return [forcedFirstMove, bestSecond];
	}
	
	// Two moves left - find best pair
	let bestPair = null;
	let bestScore = -Infinity;
	
	const evaluatedPairs = new Set();
	
	for (let i = 0; i < firstMoveCandidates.length; i++) {
		const firstMove = firstMoveCandidates[i];
		
		// Apply first move
		makeTempMove(gameState.tiles, firstMove.q, firstMove.r, cpuPlayer);
		
		// Calculate valid second move candidates based on remaining threats
		let secondMoveCandidates = candidates;
		if (hasOpponentThreats) {
			const newThreats = checkThreat();
			const newOpponentThreats = opponentPlayer === 1 ? newThreats.player1 : newThreats.player2;
			if (newOpponentThreats && newOpponentThreats.length > 0) {
				secondMoveCandidates = getBlockingMoves(newOpponentThreats);
			}
		}
		
		// Iterate over valid second move candidates only
		for (let j = 0; j < secondMoveCandidates.length; j++) {
			const secondMove = secondMoveCandidates[j];
			
			// Skip if first and second are the same
			if (firstMove.q === secondMove.q && firstMove.r === secondMove.r) continue;
			
			// Create normalized key (sorted) to avoid reversed duplicates
			const key1 = `${firstMove.q},${firstMove.r}`;
			const key2 = `${secondMove.q},${secondMove.r}`;
			const pairKey = key1 < key2 ? `${key1}-${key2}` : `${key2}-${key1}`;
			
			if (evaluatedPairs.has(pairKey)) continue;
			evaluatedPairs.add(pairKey);
			
			makeTempMove(gameState.tiles, secondMove.q, secondMove.r, cpuPlayer);
			
			const score = evaluatePosition(gameState.tiles, cpuPlayer);
			
			undoTempMove(gameState.tiles, secondMove.q, secondMove.r);
			
			if (score > bestScore) {
				bestScore = score;
				bestPair = [firstMove, secondMove];
			}
		}
		
		undoTempMove(gameState.tiles, firstMove.q, firstMove.r);
	}
	
	return bestPair;
}

// Export to browser window
if (typeof window !== 'undefined') {
	window.makeCPUMove = makeCPUMove;
}
