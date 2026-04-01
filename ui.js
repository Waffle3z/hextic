// UI Updates

// Update UI elements
function updateUI() {
	if (!playerIndicator) return;
	
	let playerText, playerClass;
	
	if (gameState.gamePhase === 'initial') {
		playerText = 'Player 1';
		playerClass = 'player-1';
	} else if (gameState.gamePhase === 'playing') {
		const currentPlayer = getCurrentPlayer();
		playerText = `Player ${currentPlayer}`;
		playerClass = `player-${currentPlayer}`;
	} else if (gameState.gamePhase === 'gameOver') {
		playerText = `P${gameState.winner} Wins!`;
		playerClass = `player-${gameState.winner}`;
	}
	
	playerIndicator.textContent = playerText;
	playerIndicator.className = playerClass;
	
	// Also update header player indicator in portrait mode
	if (headerPlayer) {
		headerPlayer.textContent = playerText;
		headerPlayer.className = playerClass;
	}
	
	if (cpuBtn) {
		cpuBtn.disabled = gameState.gamePhase === 'gameOver';
	}
	
	updateNavigationButtons();
	updateAutoMoveButton();
}

// Update navigation button states
function updateNavigationButtons() {
	if (!prevBtn || !nextBtn) return;
	
	if (prevBtn) {
		prevBtn.disabled = !moveHistoryTree.currentNode || !moveHistoryTree.currentNode.parent;
	}
	if (nextBtn) {
		nextBtn.disabled = !moveHistoryTree.currentNode || moveHistoryTree.currentNode.children.length === 0;
	}
}

// Store node references for event delegation
const nodeReferences = new Map();
let nodeIdCounter = 0;

function getHistoryTurnNumber(node) {
	if (!node) {
		return 0;
	}

	if (typeof getTurnNumberForNode === 'function') {
		return getTurnNumberForNode(node);
	}

	if (typeof node.turnNumber === 'number') {
		return node.turnNumber;
	}

	return 0;
}

function formatHistoryMove(node) {
	if (!node || node.isTurnWrapper) {
		return '';
	}

	let text = `(${node.q}, ${node.r})`;
	if (node.isWin) {
		text += '#';
	}
	if (node.isCheck) {
		text += '+';
	}

	return text;
}

function appendHistoryRow(firstNode, secondNode, turnNum, branchDepth) {
	if (!firstNode) {
		return;
	}

	const targetNode = secondNode || firstNode;
	const rowElement = document.createElement('div');
	rowElement.className = branchDepth > 0 ? 'move-row branch-row' : 'move-row';
	if (branchDepth > 0) {
		rowElement.style.marginLeft = `${branchDepth * 30}px`;
	}

	const moveItem = document.createElement('div');
	moveItem.className = `move-item player-${firstNode.player}-move`;
	if (moveHistoryTree.currentNode === targetNode) {
		moveItem.classList.add('current');
	}

	const decisiveNode = secondNode || firstNode;
	if (decisiveNode.isWin) {
		moveItem.classList.add(decisiveNode.winPlayer === 1 ? 'p1-wins' : 'p2-wins');
	}

	const nodeId = ++nodeIdCounter;
	moveItem.dataset.nodeId = nodeId;
	nodeReferences.set(nodeId, targetNode);

	let displayText = formatHistoryMove(firstNode);
	if (secondNode) {
		displayText += ` ${formatHistoryMove(secondNode)}`;
	}

	moveItem.innerHTML = `
		<span class="move-num">${turnNum}.</span>
		<span class="move-text">${displayText}</span>
	`;

	rowElement.appendChild(moveItem);
	moveHistory.appendChild(rowElement);
}

function getHistoryTurnVariants(anchorNode) {
	if (!anchorNode) {
		return [];
	}

	const anchorTurnNumber = getHistoryTurnNumber(anchorNode);
	const firstMoveOptions = anchorNode.children.filter(
		child => getHistoryTurnNumber(child) !== anchorTurnNumber
	);
	const variants = [];

	for (const firstNode of firstMoveOptions) {
		const turnNumber = getHistoryTurnNumber(firstNode);
		const secondMoveOptions = firstNode.children.filter(
			child => getHistoryTurnNumber(child) === turnNumber
		);

		if (secondMoveOptions.length === 0) {
			variants.push({
				firstNode: firstNode,
				secondNode: null,
				endNode: firstNode
			});
			continue;
		}

		for (const secondNode of secondMoveOptions) {
			variants.push({
				firstNode: firstNode,
				secondNode: secondNode,
				endNode: secondNode
			});
		}
	}

	return variants;
}

function renderHistoryTurnVariant(variant, turnNum, branchDepth) {
	if (!variant) {
		return;
	}

	appendHistoryRow(variant.firstNode, variant.secondNode, turnNum, branchDepth);
	renderHistoryContinuation(variant.endNode, turnNum + 1, branchDepth);
}

function renderHistoryContinuation(anchorNode, turnNum, branchDepth) {
	const variants = getHistoryTurnVariants(anchorNode);
	if (variants.length === 0) {
		return;
	}

	for (let i = 1; i < variants.length; i++) {
		renderHistoryTurnVariant(variants[i], turnNum, branchDepth + 1);
	}

	renderHistoryTurnVariant(variants[0], turnNum, branchDepth);
}

// Render the move history with branching support
function renderMoveHistory() {
	moveHistory.innerHTML = '';
	nodeReferences.clear();
	nodeIdCounter = 0;
	
	if (!moveHistoryTree.root) return;

	const root = moveHistoryTree.root;
	if (root.isTurnWrapper) {
		if (root.children[0]) {
			appendHistoryRow(root.children[0], null, 1, 0);
			renderHistoryContinuation(root.children[0], 2, 0);
		}
	} else {
		appendHistoryRow(root, null, 1, 0);
		renderHistoryContinuation(root, 2, 0);
	}
	
	// Update navigation button states
	updateNavigationButtons();
	
	// Scroll to current move if not visible
	const currentMoveElement = moveHistory.querySelector('.current');
	if (currentMoveElement) {
		currentMoveElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
}

// Handle move history clicks via event delegation (avoids memory leak)
function setupMoveHistoryDelegation() {
	moveHistory.addEventListener('click', (e) => {
		const moveItem = e.target.closest('.move-item');
		if (moveItem && moveItem.dataset.nodeId) {
			const nodeId = parseInt(moveItem.dataset.nodeId, 10);
			const targetNode = nodeReferences.get(nodeId);
			if (targetNode) {
				// Navigate to the target node
				goToMove(targetNode);
				updateUI();
				render();
				renderMoveHistory();
			}
		}
	});
}

// Restart the game
function restartGame() {
	resetGameState();
	
	moveHistory.innerHTML = '';
	centerOn(0, 0);
	updateUI();
	
	// Update toggle button visuals
	if (coordsBtn) {
		coordsBtn.classList.toggle('active', viewState.showCoordinates);
	}
	if (threatsBtn) {
		threatsBtn.classList.toggle('active', viewState.showThreats);
	}
	
	render();
}

// Initialize the game
function init() {
	// Initialize DOM elements first
	if (!initDOMElements()) {
		console.error('Failed to initialize game - DOM elements not found');
		return;
	}
	
	// Validate all required DOM elements exist
	if (!restartBtn || !prevBtn || !nextBtn || !coordsBtn || !moveHistory) {
		console.error('Failed to initialize game - missing UI elements');
		return;
	}
	
	// Initialize toggle button visuals based on viewState
	if (coordsBtn) {
		coordsBtn.classList.toggle('active', viewState.showCoordinates);
	}
	if (threatsBtn) {
		threatsBtn.classList.toggle('active', viewState.showThreats);
	}
	
	// Update UI to populate header player indicator
	updateUI();
	
	// First resize canvas to properly initialize dimensions
	resizeCanvas();
	// Center the view on the origin (0, 0) BEFORE first render
	centerOn(0, 0);
	// Initial render is called inside resizeCanvas, but with wrong offset
	// So render again after centering
	render();
	setupEventListeners();
	setupMoveHistoryDelegation();
	setupRulesToggle();
}

// Toggle rules panel visibility
function toggleRules() {
	const rulesPanel = document.querySelector('.rules');
	if (rulesPanel) {
		rulesPanel.classList.toggle('visible');
	}
}

// Setup rules toggle button
function setupRulesToggle() {
	if (rulesToggle) {
		rulesToggle.addEventListener('click', toggleRules);
	}
}

// Auto-initialize when script loads
if (typeof document !== 'undefined') {
	init();
}

// Export to browser window
if (typeof window !== 'undefined') {
	window.updateUI = updateUI;
	window.renderMoveHistory = renderMoveHistory;
	window.restartGame = restartGame;
	window.init = init;
}
