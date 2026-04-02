// Hexagonal Tic-Tac-Toe Game Constants

// Board configuration
const HEX_SIZE = 30;
const HEX_PADDING = 2; // Padding between hexagons in pixels
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const WINNING_LENGTH = 6;
const RENDER_HORIZON = 8;

// Colors
const COLORS = {
	player1: '#e74c3c',
	player1Light: '#c0392b',
	player2: '#3498db',
	player2Light: '#2980b9',
	empty: 'rgba(255, 255, 255, 0.2)',
	emptyHover: 'rgba(255, 255, 255, 0.4)',
	background: '#0d1117',
	grid: 'rgba(255, 255, 255, 0.15)',
	highlight: '#f1c40f', // Highlight color for first move and hover
	highlightGlow: 'rgba(241, 196, 15, 0.4)',
	threat: '#e74c3c',	 // Threat warning color
	threatGlow: 'rgba(231, 76, 60, 0.4)',
	turnHighlight: '#dddddd', // Turn highlight color
};

// Hex direction vectors in axial coordinates
const HEX_DIRECTIONS = [
	{ q: 1, r: 0 },  // East
	{ q: 1, r: -1 }, // Northeast
	{ q: 0, r: -1 }, // Northwest
	{ q: -1, r: 0 }, // West
	{ q: -1, r: 1 }, // Southwest
	{ q: 0, r: 1 }	 // Southeast
];

// Export to browser window
if (typeof window !== 'undefined') {
	window.HEX_SIZE = HEX_SIZE;
	window.HEX_PADDING = HEX_PADDING;
	window.MIN_ZOOM = MIN_ZOOM;
	window.MAX_ZOOM = MAX_ZOOM;
	window.WINNING_LENGTH = WINNING_LENGTH;
	window.RENDER_HORIZON = RENDER_HORIZON;
	window.COLORS = COLORS;
	window.HEX_DIRECTIONS = HEX_DIRECTIONS;
}
