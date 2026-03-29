// Hexagonal Grid Utilities
// Using axial coordinates (q, r) for pointy-top hexagons

// Convert axial coordinates to pixel coordinates
// For pointy-top hexes: x = size * (sqrt(3) * q + sqrt(3)/2 * r), y = size * (3/2 * r)
function hexToPixel(q, r, zoom = 1) {
	const size = HEX_SIZE * zoom;
	const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
	const y = size * (3/2 * r);
	return { x, y };
}

// Convert pixel coordinates to axial coordinates
// Inverse of pointy-top hexToPixel
function pixelToHex(x, y, zoom = 1) {
	const size = HEX_SIZE * zoom;
	const q = (Math.sqrt(3)/3 * x - 1/3 * y) / size;
	const r = (2/3 * y) / size;
	return hexRound(q, r);
}

// Round fractional axial coordinates to nearest hex
function hexRound(q, r) {
	let s = -q - r;
	let rq = Math.round(q);
	let rr = Math.round(r);
	let rs = Math.round(s);
	
	const qDiff = Math.abs(rq - q);
	const rDiff = Math.abs(rr - r);
	const sDiff = Math.abs(rs - s);
	
	if (qDiff > rDiff && qDiff > sDiff) {
		rq = -rr - rs;
	} else if (rDiff > sDiff) {
		rr = -rq - rs;
	}
	
	return { q: rq, r: rr };
}

// Convert screen pixel to hex coordinates
function screenToHex(screenX, screenY, offsetX, offsetY, zoom) {
	const worldX = screenX - offsetX;
	const worldY = screenY - offsetY;
	return pixelToHex(worldX, worldY, zoom);
}

// =============================================================================
// Pairing Functions for Coordinate Serialization
// =============================================================================
// These functions convert between hex coordinates (q, r) and natural numbers
// using the Szudzik pairing function.

// Convert an integer (which can be negative) to a natural number (non-negative)
// This is a bijection: Z -> N
function intToNat(x) {
	return x > 0 ? x * 2 - 1 : x * -2;
}

// Convert a natural number back to an integer
// This is the inverse of intToNat: N -> Z
function intFromNat(x) {
	return x % 2 === 1 ? (x + 1) / 2 : x / -2;
}

// Pair two natural numbers into a single natural number
// This is a bijection: N x N -> N
// Uses the Cantor pairing function variant for efficiency
function pair(x, y) {
	// Ensure non-negative inputs
	x = Math.max(0, Math.floor(x));
	y = Math.max(0, Math.floor(y));
	return x >= y ? x * x + x + y : y * y + x;
}

// Unpair a natural number into two natural numbers
// This is the inverse of pair: N -> N x N
// Returns [x, y]
function unpair(z) {
	z = Math.max(0, Math.floor(z));
	const w = Math.floor(Math.sqrt(z));
	const t = w * w;
	return z - t < w ? [z - t, w] : [w, z - t - w];
}

// Convert hex coordinates (q, r) to a natural number
// This encodes both q and r into a single natural number
function hexToNat(q, r) {
	const natQ = intToNat(q);
	const natR = intToNat(r);
	return pair(natQ, natR);
}

// Convert a natural number back to hex coordinates (q, r)
// Returns { q, r }
function natToHex(nat) {
	const [natQ, natR] = unpair(nat);
	return {
		q: intFromNat(natQ),
		r: intFromNat(natR)
	};
}

// Export to browser window
if (typeof window !== 'undefined') {
	window.hexToPixel = hexToPixel;
	window.screenToHex = screenToHex;
	window.intToNat = intToNat;
	window.intFromNat = intFromNat;
	window.pair = pair;
	window.unpair = unpair;
	window.hexToNat = hexToNat;
	window.natToHex = natToHex;
}
