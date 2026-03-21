// Game Renderer

// Render the game
function render() {
    if (!canvas || !ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
    
    // Get hexes to render
    const hexesToRender = getHexesToRender();
    
    // Get threat hexes if enabled
    const threatHexes = viewState.showThreats ? getThreatHexes() : new Set();
    
    // Draw hexes
    for (const hex of hexesToRender) {
        drawHex(hex.q, hex.r, threatHexes);
    }
    
    // Draw winning line if game is over
    if (gameState.winningLine.length > 0) {
        drawWinningLine();
    }
}

// Get hexes to render
function getHexesToRender() {
    const hexes = new Set();
    const renderDistance = window.RENDER_HORIZON;
    
    // During initial phase, ONLY return the origin hex (0,0)
    // This ensures only the first playable cell exists on the first turn
    if (gameState.gamePhase === 'initial') {
        hexes.add(getHexKey(0, 0));
    } else if (gameState.tiles.size === 0) {
        // No tiles placed yet - show origin area
        hexes.add(getHexKey(0, 0));
    } else {
        // During playing/gameOver phase, add hexes around each tile
        // Use a Set to track all hexes we need to check
        const tilesToCheck = new Set();
        
        // First add all placed tiles
        for (const key of gameState.tiles.keys()) {
            tilesToCheck.add(key);
        }
        
        // Then add all hexes within render distance of each tile
        for (const key of gameState.tiles.keys()) {
            const [q, r] = key.split(',').map(Number);
            
            for (let dq = -renderDistance; dq <= renderDistance; dq++) {
                for (let dr = -renderDistance; dr <= renderDistance; dr++) {
                    // Axial distance formula: (|dq| + |dr| + |dq+dr|) / 2
                    const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
                    if (dist <= renderDistance) {
                        tilesToCheck.add(getHexKey(q + dq, r + dr));
                    }
                }
            }
        }
        
        // Add all hexes to the result set
        for (const key of tilesToCheck) {
            hexes.add(key);
        }
    }
    
    // Convert to array
    const result = [];
    for (const key of hexes) {
        const [q, r] = key.split(',').map(Number);
        result.push({ q, r });
    }
    
    // Sort by distance from center for better rendering order
    result.sort((a, b) => {
        const distA = (Math.abs(a.q) + Math.abs(a.r) + Math.abs(a.q + a.r)) / 2;
        const distB = (Math.abs(b.q) + Math.abs(b.r) + Math.abs(b.q + b.r)) / 2;
        return distA - distB;
    });
    
    return result;
}

// Draw a single hex
function drawHex(q, r, threatHexes) {
    // Handle case where threatHexes is not passed or is not a Map
    // getHexesToRender passes a Set when showThreats is false, but we need a Map
    if (!threatHexes || !(threatHexes instanceof Map)) {
        threatHexes = new Map();
    }
    
    const pos = hexToPixel(q, r, viewState.zoom);
    const x = pos.x + viewState.offsetX;
    const y = pos.y + viewState.offsetY;
    const size = (HEX_SIZE - HEX_PADDING) * viewState.zoom;
    
    // Check if visible
    if (x < -size || x > canvas.width + size || y < -size || y > canvas.height + size) {
        return;
    }
    
    const player = gameState.tiles.get(getHexKey(q, r));
    const threatInfo = threatHexes.get(getHexKey(q, r));
    
    // Check if this hex is being hovered
    const isHovered = hoverState.hex && hoverState.hex.q === q && hoverState.hex.r === r;
    
    // Check if this is the first move highlight (center hex on initial phase)
    // Only highlight center hex on hover during initial phase
    const isLegalFirstMove = gameState.gamePhase === 'initial' && q === 0 && r === 0;
    
    // Only show hover effect on empty hexes
    const isEmpty = player === undefined;
    
    const isHoveredLegalMove = isHovered && isLegalFirstMove;
    const isHoveredIllegalMove = isHovered && !isLegalFirstMove && gameState.gamePhase === 'initial' && isEmpty;
    
    // Determine hover color based on game state
    let hoverColor;
    const currentPlayer = getCurrentPlayer();
    if (gameState.gamePhase === 'gameOver') {
        // Grey when game is over - no more tiles can be placed
        hoverColor = 'rgba(128, 128, 128, 0.6)';
    } else if (gameState.gamePhase === 'initial') {
        hoverColor = COLORS.player1; // Player 1 is red
    } else if (currentPlayer === 1) {
        hoverColor = COLORS.player1;
    } else if (currentPlayer === 2) {
        hoverColor = COLORS.player2;
    } else {
        hoverColor = COLORS.emptyHover;
    }
    
    // Draw hex shape (pointy-top)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i - Math.PI / 2; // Pointy-top starts at -90 degrees (top)
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(hx, hy);
        } else {
            ctx.lineTo(hx, hy);
        }
    }
    ctx.closePath();
    
    // Fill based on player
    if (player === 1) {
        ctx.fillStyle = COLORS.player1;
        ctx.fill();
        ctx.strokeStyle = COLORS.player1Light;
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (player === 2) {
        ctx.fillStyle = COLORS.player2;
        ctx.fill();
        ctx.strokeStyle = COLORS.player2Light;
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        // Empty hex - always draw the grid
        // In initial phase (no tiles), show the fainter grid
        // Near tiles, show darker grid
        const nearTile = isNearTile(q, r);
        
        // Don't fill with transparent - just stroke to avoid double-drawing brightness issue
        // Use darker grid when near tiles, otherwise use lighter grid
        ctx.strokeStyle = (nearTile && gameState.tiles.size > 0) ? COLORS.grid : COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Draw hover effect - only show when actually hovering
    // Only show hover on empty hexes (not on hexes that already have tiles)
    // Hover highlight is drawn ON TOP of the grid
    const shouldShowHover = isHovered && isEmpty;
    
    // First move highlight should be red (Player 1's color)
    const firstMoveHighlightColor = COLORS.player1;
    const firstMoveHighlightGlow = 'rgba(231, 76, 60, 0.4)';
    
    // For illegal first turn hover (other hexes), use light grey
    const illegalHoverStroke = 'rgba(128, 128, 128, 0.7)';
    
    if (shouldShowHover) {
        // Draw glow effect
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i - Math.PI / 2;
            const hx = x + size * Math.cos(angle);
            const hy = y + size * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(hx, hy);
            } else {
                ctx.lineTo(hx, hy);
            }
        }
        ctx.closePath();
        
        // Determine fill style
        let fillStyle = null;
        let strokeStyle = hoverColor;
        let lineWidth = 2;
        
        if (isLegalFirstMove) {
            // Legal first move - show red glow (full highlight)
            fillStyle = firstMoveHighlightGlow;
            strokeStyle = firstMoveHighlightColor;
            lineWidth = 3;
        } else if (isHoveredIllegalMove) {
            // Non-origin hexes during initial phase - border only, no fill
            strokeStyle = illegalHoverStroke;
        } else if (gameState.gamePhase === 'initial') {
            // Initial phase but not legal first move - border only
            strokeStyle = illegalHoverStroke;
        } else if (gameState.gamePhase === 'gameOver') {
            // Game over - only show stroke, no fill
            fillStyle = null;
        } else {
            // Normal gameplay - use player color with transparency
            fillStyle = hoverColor + '66';
        }
        
        // Apply fill if needed
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
        
        // Apply stroke
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    
    // Draw coordinates for hexes with tiles or near tiles
    if (viewState.showCoordinates && (player || (q === 0 && r === 0))) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `${10 * viewState.zoom}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${q},${r}`, x, y);
    }
    
    // Draw threat indicator
    if (threatInfo && !player) {
        // Determine color based on who has the threat
        let threatColor;
        if (threatInfo.player === 1) {
            threatColor = COLORS.player1;
        } else if (threatInfo.player === 2) {
            threatColor = COLORS.player2;
        } else {
            // Both players have threats - use white
            threatColor = '#ffffff';
        }
        
        // Draw a colored "!" in the center
        ctx.fillStyle = threatColor;
        ctx.font = `bold ${14 * viewState.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', x, y);
        
        // Add glow effect
        ctx.shadowColor = threatColor;
        ctx.shadowBlur = 8;
        ctx.fillText('!', x, y);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
}

// Check if hex is near a placed tile
function isNearTile(q, r) {
    if (gameState.tiles.size === 0) return true;
    
    for (const key of gameState.tiles.keys()) {
        const [tq, tr] = key.split(',').map(Number);
        const dq = q - tq;
        const dr = r - tr;
        // Axial distance formula: (|dq| + |dr| + |dq+dr|) / 2
        const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
        if (dist <= 6) return true;
    }
    return false;
}

// Draw winning line
function drawWinningLine() {
    if (gameState.winningLine.length < 2) return;
    
    const firstHex = gameState.winningLine[0];
    const lastHex = gameState.winningLine[gameState.winningLine.length - 1];
    
    const startPos = hexToPixel(firstHex.q, firstHex.r, viewState.zoom);
    const endPos = hexToPixel(lastHex.q, lastHex.r, viewState.zoom);
    
    const x1 = startPos.x + viewState.offsetX;
    const y1 = startPos.y + viewState.offsetY;
    const x2 = endPos.x + viewState.offsetX;
    const y2 = endPos.y + viewState.offsetY;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = COLORS.highlight;
    ctx.lineWidth = 4 * viewState.zoom;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Add glow effect
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
}

// Get hexes that are part of threats with player info
// Returns Map: key -> { player: 1|2|'both', hex: {q, r} }
function getThreatHexes() {
    const threatInfo = new Map();
    
    if (gameState.gamePhase === 'gameOver') return threatInfo;
    
    const threats = checkThreat();
    
    // Process player 1 threats
    if (threats.player1) {
        for (const threatLine of threats.player1) {
            for (const hex of threatLine) {
                const key = getHexKey(hex.q, hex.r);
                if (threatInfo.has(key)) {
                    const existing = threatInfo.get(key);
                    // Only mark as 'both' if the existing threat is from a DIFFERENT player
                    if (existing.player !== 1) {
                        threatInfo.set(key, { player: 'both', q: hex.q, r: hex.r });
                    }
                    // If same player, keep as is (don't change 1 to 1)
                } else {
                    threatInfo.set(key, { player: 1, q: hex.q, r: hex.r });
                }
            }
        }
    }
    
    // Process player 2 threats
    if (threats.player2) {
        for (const threatLine of threats.player2) {
            for (const hex of threatLine) {
                const key = getHexKey(hex.q, hex.r);
                if (threatInfo.has(key)) {
                    const existing = threatInfo.get(key);
                    // Only mark as 'both' if the existing threat is from a DIFFERENT player
                    if (existing.player !== 2) {
                        threatInfo.set(key, { player: 'both', q: hex.q, r: hex.r });
                    }
                    // If same player, keep as is (don't change 2 to 2)
                } else {
                    threatInfo.set(key, { player: 2, q: hex.q, r: hex.r });
                }
            }
        }
    }
    
    return threatInfo;
}

// Export to browser window
if (typeof window !== 'undefined') {
    window.render = render;
    window.getHexesToRender = getHexesToRender;
    window.drawHex = drawHex;
    window.isNearTile = isNearTile;
    window.drawWinningLine = drawWinningLine;
    window.getThreatHexes = getThreatHexes;
}
