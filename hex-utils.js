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

// Export to browser window
if (typeof window !== 'undefined') {
    window.hexToPixel = hexToPixel;
    window.pixelToHex = pixelToHex;
    window.hexRound = hexRound;
    window.screenToHex = screenToHex;
}
