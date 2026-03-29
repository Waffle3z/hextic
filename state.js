// Game State Management

// DOM elements - accessed after DOM is loaded (scripts are at end of body)
let canvas, ctx, playerIndicator, headerPlayer, headerPlayerContainer, moveHistory, restartBtn, prevBtn, nextBtn, coordsBtn, cpuBtn, threatsBtn, rulesToggle, autoMoveBtn, copyBtn, pasteBtn, menuBtn, hamburgerMenu;

// Initialize DOM elements - should be called after DOM is ready
function initDOMElements() {
	canvas = document.getElementById('game-canvas');
	ctx = canvas ? canvas.getContext('2d') : null;
	playerIndicator = document.getElementById('player-indicator');
	headerPlayer = document.getElementById('header-player');
	headerPlayerContainer = document.querySelector('.header-player-container');
	moveHistory = document.getElementById('move-history');
	restartBtn = document.getElementById('restart-btn');
	prevBtn = document.getElementById('prev-btn');
	nextBtn = document.getElementById('next-btn');
	coordsBtn = document.getElementById('coords-btn');
	cpuBtn = document.getElementById('cpu-btn');
	threatsBtn = document.getElementById('threats-btn');
	rulesToggle = document.getElementById('rules-toggle');
	autoMoveBtn = document.getElementById('auto-move-btn');
	copyBtn = document.getElementById('copy-btn');
	pasteBtn = document.getElementById('paste-btn');
	menuBtn = document.getElementById('menu-btn');
	hamburgerMenu = document.getElementById('hamburger-menu');
	
	// Validate all required elements exist
	if (!canvas || !ctx) {
		console.error('Failed to initialize canvas');
		return false;
	}
	return true;
}

// Game state
let gameState = {
	tiles: new Map(), // key: "q,r", value: 1 or 2
	gamePhase: 'initial', // 'initial', 'playing', 'gameOver'
	winner: null,
	winningLine: [],
	moveCount: 0
};

// Hover state
let hoverState = {
	hex: null, // {q, r} of currently hovered hex
	isHovering: false
};

// Move history tree structure
// Each node: { q, r, player, parent, children: [], isWin: false, winPlayer: null }
let moveHistoryTree = {
	root: null,
	currentNode: null
};

// View state
let viewState = {
	offsetX: 0,
	offsetY: 0,
	zoom: 1,
	isDragging: false,
	dragStartX: 0,
	dragStartY: 0,
	offsetStartX: 0,
	offsetStartY: 0,
	touchStartX: null,
	touchStartY: null,
	showCoordinates: true,
	showThreats: true // Enabled by default
};

// Auto-move state: 0 = disabled, 1 = auto-move for player 1, 2 = auto-move for player 2
let autoMoveState = {
	enabledPlayer: 0 // 0 = off, 1 = P1, 2 = P2
};

// Reset game state - uses Object.assign to preserve window references
function resetGameState() {
	// Clear and update existing objects instead of reassigning variables
	// This ensures window.gameState, window.viewState, etc. stay in sync
	gameState.tiles.clear();
	gameState.gamePhase = 'initial';
	gameState.winner = null;
	gameState.winningLine = [];
	gameState.moveCount = 0;
	
	moveHistoryTree.root = null;
	moveHistoryTree.currentNode = null;
	
	hoverState.hex = null;
	hoverState.isHovering = false;
	
	viewState.isDragging = false;
	viewState.dragStartX = 0;
	viewState.dragStartY = 0;
	viewState.offsetStartX = 0;
	viewState.offsetStartY = 0;
	viewState.touchStartX = null;
	viewState.touchStartY = null;
	
	autoMoveState.enabledPlayer = 0;
}

// Get hex key string
function getHexKey(q, r) {
	return `${q},${r}`;
}

// Check if a hex is empty
function isHexEmpty(q, r) {
	return !gameState.tiles.has(getHexKey(q, r));
}

// Get current player based on move count
// After the initial move (move 0), each player places 2 tiles per "turn"
// A turn consists of 2 moves by the same player, except Player 1's first turn
// Pattern (mod 4):
// - 0: Player 1 (initial single tile)
// - 1: Player 2 (first of 2)
// - 2: Player 2 (second of 2)
// - 3: Player 1 (first of 2)
// - 0: Player 1 (second of 2)
// - ... repeats
function getCurrentPlayer() {
	const mod = gameState.moveCount % 4;
	return (mod === 0 || mod === 3) ? 1 : 2;
}

// Check if at the latest position in history
function isAtLatestPosition() {
	if (!moveHistoryTree.currentNode) return true;
	return moveHistoryTree.currentNode === getLatestNode();
}

// Get the latest node in the history tree (for checking if at current position)
function getLatestNode() {
	if (!moveHistoryTree.currentNode) return null;
	
	let node = moveHistoryTree.currentNode;
	while (node.children.length > 0) {
		node = node.children[node.children.length - 1];
	}
	return node;
}

// Export to browser window
if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'canvas', { get: () => canvas, configurable: true });
	Object.defineProperty(window, 'ctx', { get: () => ctx, configurable: true });
	Object.defineProperty(window, 'playerIndicator', { get: () => playerIndicator, configurable: true });
	Object.defineProperty(window, 'moveHistory', { get: () => moveHistory, configurable: true });
	Object.defineProperty(window, 'restartBtn', { get: () => restartBtn, configurable: true });
	Object.defineProperty(window, 'prevBtn', { get: () => prevBtn, configurable: true });
	Object.defineProperty(window, 'nextBtn', { get: () => nextBtn, configurable: true });
	Object.defineProperty(window, 'coordsBtn', { get: () => coordsBtn, configurable: true });
	Object.defineProperty(window, 'cpuBtn', { get: () => cpuBtn, configurable: true });
	Object.defineProperty(window, 'threatsBtn', { get: () => threatsBtn, configurable: true });
	Object.defineProperty(window, 'autoMoveBtn', { get: () => autoMoveBtn, configurable: true });
	Object.defineProperty(window, 'copyBtn', { get: () => copyBtn, configurable: true });
	Object.defineProperty(window, 'pasteBtn', { get: () => pasteBtn, configurable: true });
	Object.defineProperty(window, 'menuBtn', { get: () => menuBtn, configurable: true });
	Object.defineProperty(window, 'hamburgerMenu', { get: () => hamburgerMenu, configurable: true });
	Object.defineProperty(window, 'autoMoveState', { get: () => autoMoveState, configurable: true });
	Object.defineProperty(window, 'gameState', { get: () => gameState, configurable: true });
	Object.defineProperty(window, 'hoverState', { get: () => hoverState, configurable: true });
	Object.defineProperty(window, 'moveHistoryTree', { get: () => moveHistoryTree, configurable: true });
	Object.defineProperty(window, 'viewState', { get: () => viewState, configurable: true });
	window.resetGameState = resetGameState;
	window.getHexKey = getHexKey;
	window.isHexEmpty = isHexEmpty;
	window.getCurrentPlayer = getCurrentPlayer;
	window.isAtLatestPosition = isAtLatestPosition;
	window.getLatestNode = getLatestNode;
	window.initDOMElements = initDOMElements;
}
