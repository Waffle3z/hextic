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
const firstMoveBestDepth = new Map();
const HISTORY_BRANCH_INDENT = 30;

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

function createHistoryRowData(firstNode, secondNode, turnNum, branchDepth, isBranchEntry = false) {
	return {
		firstNode: firstNode,
		secondNode: secondNode,
		endNode: secondNode || firstNode,
		turnNum: turnNum,
		branchDepth: branchDepth,
		branchEntryDepth: isBranchEntry ? branchDepth - 1 : null,
		connectorSegments: []
	};
}

function addHistoryConnectorData(rows, branchGroups) {
	for (const group of branchGroups) {
		if (!group || group.childRowIndices.length === 0) {
			continue;
		}

		const firstChildRowIndex = group.childRowIndices[0];
		const lastChildRowIndex = group.childRowIndices[group.childRowIndices.length - 1];

		for (let rowIndex = firstChildRowIndex; rowIndex <= lastChildRowIndex; rowIndex++) {
			const row = rows[rowIndex];
			if (!row) {
				continue;
			}

			row.connectorSegments.push({
				depth: group.depth,
				type: rowIndex === lastChildRowIndex ? 'top' : 'full'
			});
		}
	}

	for (const row of rows) {
		row.connectorSegments.sort((left, right) => left.depth - right.depth);
	}
}

function appendHistoryRow(rowData) {
	if (!rowData || !rowData.firstNode) {
		return;
	}

	const firstNode = rowData.firstNode;
	const secondNode = rowData.secondNode;
	const targetNode = rowData.endNode;
	const turnNum = rowData.turnNum;
	const branchDepth = rowData.branchDepth;
	const rowElement = document.createElement('div');
	rowElement.className = branchDepth > 0 ? 'move-row branch-row' : 'move-row';
	rowElement.style.paddingLeft = `${branchDepth * HISTORY_BRANCH_INDENT}px`;

	if (rowData.connectorSegments.length > 0 || Number.isInteger(rowData.branchEntryDepth)) {
		const connectorLayer = document.createElement('div');
		connectorLayer.className = 'history-connectors';

		for (const segment of rowData.connectorSegments) {
			const verticalLine = document.createElement('span');
			verticalLine.className = `history-connector vertical ${segment.type}`;
			verticalLine.style.left = `${(segment.depth * HISTORY_BRANCH_INDENT) + (HISTORY_BRANCH_INDENT / 2)}px`;
			connectorLayer.appendChild(verticalLine);
		}

		if (Number.isInteger(rowData.branchEntryDepth)) {
			const horizontalLine = document.createElement('span');
			horizontalLine.className = 'history-connector horizontal';
			horizontalLine.style.left = `${(rowData.branchEntryDepth * HISTORY_BRANCH_INDENT) + (HISTORY_BRANCH_INDENT / 2)}px`;
			horizontalLine.style.width = `${HISTORY_BRANCH_INDENT / 2}px`;
			connectorLayer.appendChild(horizontalLine);
		}

		rowElement.appendChild(connectorLayer);
	}

	const moveItem = document.createElement('div');
	moveItem.className = `move-item player-${firstNode.player}-move`;
	const currentNode = moveHistoryTree.currentNode;
	const isExactMatch = currentNode === targetNode;
	const isFirstOfThisTurn = currentNode === firstNode && targetNode && targetNode.turnNumber === firstNode.turnNumber;
	const isExactOrFirstMatch = isExactMatch || isFirstOfThisTurn;
	const bestData = firstMoveBestDepth.get(firstNode);
	const shouldHighlight = isExactOrFirstMatch && (!bestData || branchDepth < bestData.depth);
	if (shouldHighlight) {
		if (bestData) {
			bestData.element.classList.remove('current');
		}
		moveItem.classList.add('current');
		firstMoveBestDepth.set(firstNode, { element: moveItem, depth: branchDepth });
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

function collectHistoryTurnVariant(variant, turnNum, branchDepth, rows, branchGroups, isBranchEntry = false) {
	if (!variant) {
		return -1;
	}

	const row = createHistoryRowData(
		variant.firstNode,
		variant.secondNode,
		turnNum,
		branchDepth,
		isBranchEntry
	);
	const rowIndex = rows.length;
	rows.push(row);
	collectHistoryContinuation(variant.endNode, turnNum + 1, branchDepth, rows, branchGroups);
	return rowIndex;
}

function collectHistoryContinuation(anchorNode, turnNum, branchDepth, rows, branchGroups) {
	const variants = getHistoryTurnVariants(anchorNode);
	if (variants.length === 0) {
		return;
	}

	const branchEntryRowIndices = [];
	for (let i = 1; i < variants.length; i++) {
		const branchRowIndex = collectHistoryTurnVariant(
			variants[i],
			turnNum,
			branchDepth + 1,
			rows,
			branchGroups,
			true
		);
		if (branchRowIndex >= 0) {
			branchEntryRowIndices.push(branchRowIndex);
		}
	}

	if (branchEntryRowIndices.length > 0) {
		branchGroups.push({
			depth: branchDepth,
			childRowIndices: branchEntryRowIndices
		});
	}

	collectHistoryTurnVariant(variants[0], turnNum, branchDepth, rows, branchGroups);
}

function buildHistoryRows() {
	const rows = [];
	const branchGroups = [];
	if (!moveHistoryTree.root) {
		return rows;
	}

	const root = moveHistoryTree.root;
	if (root.isTurnWrapper) {
		if (!root.children[0]) {
			return rows;
		}

		rows.push(createHistoryRowData(root.children[0], null, 1, 0));
		collectHistoryContinuation(root.children[0], 2, 0, rows, branchGroups);
	} else {
		rows.push(createHistoryRowData(root, null, 1, 0));
		collectHistoryContinuation(root, 2, 0, rows, branchGroups);
	}

	addHistoryConnectorData(rows, branchGroups);
	return rows;
}

// Render the move history with branching support
function renderMoveHistory() {
	moveHistory.innerHTML = '';
	nodeReferences.clear();
	nodeIdCounter = 0;
	firstMoveBestDepth.clear();
	
	if (!moveHistoryTree.root) return;

	const historyRows = buildHistoryRows();
	for (const row of historyRows) {
		appendHistoryRow(row);
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
