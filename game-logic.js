// Core Game Logic

// Place a tile on the board
function placeTile(q, r, addMoveCallback) {
	// Check if hex is empty
	if (!isHexEmpty(q, r)) return false;
	
	// Check if game is over (either current or from viewing history)
	if (gameState.gamePhase === 'gameOver') return false;
	
	// Also check if viewing a historical position with a win
	if (moveHistoryTree.currentNode && moveHistoryTree.currentNode.isWin) {
		return false; // Cannot place moves after a win
	}
	
	// Check if hex is within the current render horizon
	if (!isInRenderHorizon(q, r)) return false;
	
	// In initial phase, only allow placing at center (0,0)
	if (gameState.gamePhase === 'initial') {
		if (q !== 0 || r !== 0) return false;
	}
	
	// If viewing a historical position (not at latest), create a new branch
	// Rebuild game state to that point first
	if (moveHistoryTree.currentNode && moveHistoryTree.currentNode !== getLatestNode()) {
		rebuildGameState(moveHistoryTree.currentNode);
	}
	
	// Place the tile at the specified axial coordinates
	const currentPlayer = getCurrentPlayer();
	gameState.tiles.set(getHexKey(q, r), currentPlayer);
	gameState.moveCount++;
	
	// Check for win BEFORE adding to history (so win annotation shows from the start)
	// Note: moveCount is incremented first so the moveNode gets the correct move number.
	// The win is checked before history insertion to properly annotate the winning move.
	const winningLine = checkWin(currentPlayer);
	if (winningLine) {
		gameState.gamePhase = 'gameOver';
		gameState.winner = currentPlayer;
		gameState.winningLine = winningLine;
		
		// Add to move history tree with win info
		const moveNode = addMoveToHistory(q, r, currentPlayer);
		moveNode.isWin = true;
		moveNode.winPlayer = currentPlayer;
		
		// Re-render history to show win annotation
		if (addMoveCallback) addMoveCallback();
		
		return true;
	}
	
	// Add to move history tree (no win)
	const moveNode = addMoveToHistory(q, r, currentPlayer);
	
	// Check for threat after this move - check for threats from BOTH players
	// A threat means either player has a line where they could win on their next turn
	const threats = checkThreat();
	if (threats.player1.length > 0 || threats.player2.length > 0) {
		moveNode.isCheck = true;
		if (addMoveCallback) addMoveCallback();
	}
	
	// Handle turn progression
	if (gameState.gamePhase === 'initial') {
		// Player 1 only places 1 tile on first turn, then player 2 plays
		gameState.gamePhase = 'playing';
	}
	
	return true;
}

// Check for winning line
function checkWin(player) {
	// Check all hexes that have player's tiles
	for (const [key, tilePlayer] of gameState.tiles) {
		if (tilePlayer !== player) continue;
		
		const [q, r] = key.split(',').map(Number);
		
		// Check all 6 directions
		for (const dir of window.HEX_DIRECTIONS) {
			const line = getLineInDirection(q, r, dir.q, dir.r, player);
			if (line.length >= WINNING_LENGTH) {
				return line;
			}
		}
	}
	return null;
}

// Get all connected tiles in a direction
function getLineInDirection(q, r, dq, dr, player) {
	const line = [{ q, r }];
	
	// Check forward direction
	let currQ = q + dq;
	let currR = r + dr;
	while (gameState.tiles.get(getHexKey(currQ, currR)) === player) {
		line.push({ q: currQ, r: currR });
		currQ += dq;
		currR += dr;
	}
	
	// Check backward direction
	currQ = q - dq;
	currR = r - dr;
	while (gameState.tiles.get(getHexKey(currQ, currR)) === player) {
		line.unshift({ q: currQ, r: currR });
		currQ -= dq;
		currR -= dr;
	}
	
	return line;
}

// Check for a threat from either player
// A threat is: in any nonempty line of 6 cells, if (same-colored + empty) == 6 and same-colored >= 4
// This means a player could potentially win on their next turn
// Returns an object with player1 and/or player2 threat arrays if found
function checkThreat() {
	// Use a single Set to track checked hex pairs (avoiding sorting for each window)
	// Key format: "q1,r1-q2,r2" where q1,r1 < q2,r2 lexicographically
	const checkedHexPairs = new Set();
	const player1Threats = [];
	const player2Threats = [];
	
	// For each tile on the board, build a line in each direction
	for (const [key, tile] of gameState.tiles) {
		const [q, r] = key.split(',').map(Number);
		
		// Check all 6 directions
		for (const dir of window.HEX_DIRECTIONS) {
			// Build a complete line in this direction
			const line = buildLine(q, r, dir.q, dir.r);
			
			if (line.length < WINNING_LENGTH) continue;
			
			// Check all WINNING_LENGTH-cell windows in this line
			for (let i = 0; i <= line.length - WINNING_LENGTH; i++) {
				const hexWindow = line.slice(i, i + WINNING_LENGTH);
				
				// Skip empty lines
				if (!hexWindow.some(h => h.tile !== undefined)) continue;
				
				// Create unique key for this window using sorted hex pairs
				// Only need first and last hex to uniquely identify the window
				const first = hexWindow[0];
				const last = hexWindow[WINNING_LENGTH - 1];
				const key1 = `${first.q},${first.r}`;
				const key2 = `${last.q},${last.r}`;
				const lineKey = key1 < key2 ? `${key1}|${key2}` : `${key2}|${key1}`;
				
				if (checkedHexPairs.has(lineKey)) continue;
				checkedHexPairs.add(lineKey);
				
				// Count tiles for each player (reuse line data)
				let player1Count = 0;
				let player2Count = 0;
				let emptyCount = 0;
				for (const h of hexWindow) {
					if (h.tile === 1) player1Count++;
					else if (h.tile === 2) player2Count++;
					else emptyCount++;
				}
				
				// Check for player 1 threat
				if (player1Count + emptyCount === WINNING_LENGTH && player1Count >= WINNING_LENGTH - 2) {
					player1Threats.push(hexWindow.map(h => ({ q: h.q, r: h.r })));
				}
				
				// Check for player 2 threat
				if (player2Count + emptyCount === WINNING_LENGTH && player2Count >= WINNING_LENGTH - 2) {
					player2Threats.push(hexWindow.map(h => ({ q: h.q, r: h.r })));
				}
			}
		}
	}
	
	return { player1: player1Threats, player2: player2Threats };
}

// Build a line of hexes in a direction from a starting point
function buildLine(startQ, startR, dq, dr) {
	const line = [];
	const buildDistance = WINNING_LENGTH;
	const bufferSize = buildDistance * 2;
	
	// Go backward up to WINNING_LENGTH cells
	let currQ = startQ - dq * buildDistance;
	let currR = startR - dr * buildDistance;
	for (let i = 0; i < bufferSize; i++) {
		const tile = gameState.tiles.get(getHexKey(currQ, currR));
		line.push({ q: currQ, r: currR, tile: tile });
		currQ += dq;
		currR += dr;
	}
	
	return line;
}

// Check if a hex is within the current render horizon
// This prevents placing tiles too far from existing tiles
function isInRenderHorizon(q, r) {
	// During initial phase, only allow center (0,0)
	if (gameState.gamePhase === 'initial') {
		return q === 0 && r === 0;
	}
	
	// If no tiles yet, only allow center
	if (gameState.tiles.size === 0) {
		return q === 0 && r === 0;
	}
	
	// Check if any placed tile is within render distance
	for (const key of gameState.tiles.keys()) {
		const [tq, tr] = key.split(',').map(Number);
		const dq = q - tq;
		const dr = r - tr;
		// Axial distance formula: (|dq| + |dr| + |dq+dr|) / 2
		const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
		if (dist <= RENDER_HORIZON) {
			return true;
		}
	}
	
	return false;
}

// Rebuild game state from move history
function rebuildGameState(targetNode) {
	// Clear current tiles
	gameState.tiles.clear();
	
	// Collect all moves from root to target
	const moves = [];
	let node = targetNode;
	while (node) {
		moves.unshift(node);
		node = node.parent;
	}
	
	// Replay moves
	gameState.moveCount = 0;
	
	for (let i = 0; i < moves.length; i++) {
		const move = moves[i];
		gameState.tiles.set(getHexKey(move.q, move.r), move.player);
		gameState.moveCount++;
	}
	
	// Ensure the target node's branchCount is set (for proper indentation)
	if (targetNode) {
		// Calculate branch count from root to this node
		let branchCount = 0;
		let checkNode = targetNode;
		while (checkNode.parent) {
			if (checkNode.parent.children.length > 1) {
				branchCount++;
			}
			checkNode = checkNode.parent;
		}
		targetNode.branchCount = branchCount;
	}
	
	// Determine game phase
	if (gameState.moveCount === 0) {
		gameState.gamePhase = 'initial';
	} else {
		gameState.gamePhase = 'playing';
	}
	
	// Check if target node has a win
	if (targetNode && targetNode.isWin) {
		gameState.gamePhase = 'gameOver';
		gameState.winner = targetNode.winPlayer;
		// Calculate winning line
		gameState.winningLine = checkWin(targetNode.winPlayer) || [];
	} else {
		// Clear win state
		gameState.winner = null;
		gameState.winningLine = [];
	}
	
	// Recalculate threats after rebuilding state
	const threats = checkThreat();
	if (targetNode) {
		targetNode.isCheck = threats.player1.length > 0 || threats.player2.length > 0;
	}
}

// Export to browser window
if (typeof window !== 'undefined') {
	window.placeTile = placeTile;
	window.checkWin = checkWin;
	window.checkThreat = checkThreat;
	window.rebuildGameState = rebuildGameState;
}
