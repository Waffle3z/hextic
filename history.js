// Move History Tree Management

// Add move to history tree
function addMoveToHistory(q, r, player) {
	// Check if the current node already has a child with this exact move (same position)
	// This means we've already made this exact move from this exact position in the game tree
	if (moveHistoryTree.currentNode) {
		const existingChild = moveHistoryTree.currentNode.children.find(
			child => child.q === q && child.r === r
		);
		if (existingChild) {
			// Found an existing move at this position from the same parent - navigate to it
			moveHistoryTree.currentNode = existingChild;
			renderMoveHistory();
			return existingChild;
		}
	}
	
	// Calculate branch count - inherit from parent and increment if this is a branch (parent already has children)
	let branchCount = 0;
	if (moveHistoryTree.currentNode) {
		branchCount = moveHistoryTree.currentNode.branchCount || 0;
		// If the parent already has children, this is a branch - increment the count
		if (moveHistoryTree.currentNode.children.length > 0) {
			branchCount++;
		}
	}
	
	const moveNode = {
		q: q,
		r: r,
		player: player,
		parent: moveHistoryTree.currentNode,
		children: [],
		isWin: false,
		winPlayer: null,
		moveNum: gameState.moveCount,
		turnNumber: getTurnNumberFromMoveNumber(gameState.moveCount),
		branchCount: branchCount
	};
	
	// If current node exists and has children, we're branching
	if (moveHistoryTree.currentNode) {
		moveHistoryTree.currentNode.children.push(moveNode);
	} else {
		// First move - create root
		moveHistoryTree.root = moveNode;
	}
	
	// Move to the new node
	moveHistoryTree.currentNode = moveNode;
	moveHistoryTree.latestNode = moveNode;
	
	// Render the history
	renderMoveHistory();
	
	return moveNode;
}

// Navigate to a specific move
function goToMove(targetNode) {
	// Disable auto-move when navigating history
	if (autoMoveState && autoMoveState.enabledPlayer !== 0) {
		autoMoveState.enabledPlayer = 0;
		updateAutoMoveButton();
	}
	
	// Rebuild game state from root to target node
	rebuildGameState(targetNode);
	
	// Set current node
	moveHistoryTree.currentNode = targetNode;
	
	// Update UI
	updateUI();
	render();
	renderMoveHistory();
}

// Get all moves for a given turn number from the current path in history
// This traverses from root to currentNode to find moves only in the current branch
function getMovesForTurn(turnNumber) {
	const moves = [];
	
	if (!moveHistoryTree.root || turnNumber <= 0) {
		return moves;
	}
	
	// If currentNode is not set, can't determine the current path
	if (!moveHistoryTree.currentNode) {
		return moves;
	}
	
	// Traverse from currentNode back to root, collecting nodes with the same turn number
	let node = moveHistoryTree.currentNode;
	const nodesOnPath = [];
	
	while (node) {
		nodesOnPath.push(node);
		node = node.parent;
	}
	
	// Now filter to only nodes with the given turn number
	for (const n of nodesOnPath) {
		if (n.turnNumber === turnNumber) {
			moves.push(n);
		}
	}
	
	return moves;
}

// Get the hex keys for all moves in a given turn (current branch only)
function getTurnHighlightHexes(turnNumber) {
	const hexKeys = new Set();
	const moves = getMovesForTurn(turnNumber);
	
	for (const move of moves) {
		hexKeys.add(getHexKey(move.q, move.r));
	}
	
	return hexKeys;
}

// Go to previous move
function goToPreviousMove() {
	if (!moveHistoryTree.currentNode || !moveHistoryTree.currentNode.parent) {
		// If at root or no history, can't go back further
		if (!moveHistoryTree.currentNode && moveHistoryTree.root) {
			// At the "no moves" state, go to root
			goToMove(moveHistoryTree.root);
		}
		return;
	}
	
	goToMove(moveHistoryTree.currentNode.parent);
}

// Go to next move (if branching, could choose first child)
function goToNextMove() {
	if (!moveHistoryTree.currentNode || moveHistoryTree.currentNode.children.length === 0) {
		return;
	}
	
	goToMove(moveHistoryTree.currentNode.children[0]);
}

// Export to browser window
if (typeof window !== 'undefined') {
	window.addMoveToHistory = addMoveToHistory;
	window.goToMove = goToMove;
	window.goToPreviousMove = goToPreviousMove;
	window.goToNextMove = goToNextMove;
	window.getMovesForTurn = getMovesForTurn;
	window.getTurnHighlightHexes = getTurnHighlightHexes;
}
