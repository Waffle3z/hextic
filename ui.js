// UI Updates

// Game initialization guard
let gameInitialized = false;

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
    
    // Disable CPU button in game over state
    if (cpuBtn) {
        cpuBtn.disabled = gameState.gamePhase === 'gameOver';
    }
    
    // Update navigation buttons
    updateNavigationButtons();
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

// Render the move history with branching support
function renderMoveHistory() {
    moveHistory.innerHTML = '';
    nodeReferences.clear();
    nodeIdCounter = 0;
    
    if (!moveHistoryTree.root) return;
    
    // Build a list of all paths to render
    // We'll render from root to current, marking branches
    renderMoveNode(moveHistoryTree.root, 0, []);
    
    // Update navigation button states
    updateNavigationButtons();
    
    // Scroll to current move if not visible
    const currentMoveElement = moveHistory.querySelector('.current');
    if (currentMoveElement) {
        currentMoveElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Recursively render move nodes
function renderMoveNode(node, depth, pathIndices) {
    if (!node) return;
    
    const isCurrent = node === moveHistoryTree.currentNode;
    const hasBranches = node.children.length > 1;
    
    // Assign unique ID for event delegation
    const nodeId = ++nodeIdCounter;
    nodeReferences.set(nodeId, node);
    
    // For PGN-style ordering: render branches BEFORE the main line
    // Only render children that are branches (children[0] is the main line continuation)
    // Children at index > 0 are branches that should appear before the main move
    const branchChildren = node.children.slice(1); // All children except first (main line)
    const mainChild = node.children[0]; // First child is the main line continuation
    
    // Render the main line move first
    // Create the move item
    const moveItem = document.createElement('div');
    moveItem.className = `move-item player-${node.player}-move`;
    moveItem.dataset.nodeId = nodeId;
    if (isCurrent) {
        moveItem.classList.add('current');
    }
    
    // Build display text
    let displayText = `(${node.q}, ${node.r})`;
    if (node.isWin) {
        displayText += `#`;
        // Add winner color class
        moveItem.classList.add(node.winPlayer === 1 ? 'p1-wins' : 'p2-wins');
    }
    if (node.isCheck) {
        displayText += `+`;
    }
    
    moveItem.innerHTML = `
        <span class="move-num">${node.moveNum}.</span>
        <span class="move-text">${displayText}</span>
    `;
    
    // Add indent based on tree DEPTH - main line has no indent, branches are indented
    // The depth parameter represents how many levels deep we are in the tree
    // Only indent if we're not at the root level (depth > 0 means we're not the first move)
    // A node is on the main line only if ALL elements in pathIndices are 0
    // If ANY element > 0, it's part of a branch and should be indented
    const isOnMainLine = pathIndices.every(index => index === 0);
    const isBranch = !isOnMainLine;
    if (depth > 0 && isBranch) {
        // Count how many branch levels deep we are (number of indices > 0 in the path)
        const branchDepth = pathIndices.filter(index => index > 0).length;
        // Indent based on branch depth, but cap it to avoid excessive indentation
        const indentLevel = Math.min(branchDepth, 10);
        moveItem.style.paddingLeft = `${indentLevel * 20 + 6}px`;
    }
    
    moveHistory.appendChild(moveItem);
    
    // Then render branches AFTER the main line move (they appear indented under it)
    branchChildren.forEach((child, index) => {
        renderMoveNode(child, depth + 1, [...pathIndices, index + 1]);
    });
    
    // Finally render main line child
    if (mainChild) {
        renderMoveNode(mainChild, depth + 1, [...pathIndices, 0]);
    }
}

// Handle move history clicks via event delegation (avoids memory leak)
function setupMoveHistoryDelegation() {
    moveHistory.addEventListener('click', (e) => {
        const moveItem = e.target.closest('.move-item');
        if (moveItem && moveItem.dataset.nodeId) {
            const nodeId = parseInt(moveItem.dataset.nodeId, 10);
            const node = nodeReferences.get(nodeId);
            if (node) {
                goToMove(node);
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

// Auto-initialize when script loads (with guard to prevent duplicate initialization)
if (typeof document !== 'undefined') {
    // Check if already initialized by looking for the canvas
    if (!gameInitialized) {
        gameInitialized = true;
        init();
    }
}

// Export to browser window
if (typeof window !== 'undefined') {
    window.updateUI = updateUI;
    window.updateNavigationButtons = updateNavigationButtons;
    window.renderMoveHistory = renderMoveHistory;
    window.restartGame = restartGame;
    window.init = init;
    window.setupMoveHistoryDelegation = setupMoveHistoryDelegation;
}
