// CPU Player Logic

// Get all "witnessed" hexes - empty hexes that are:
// 1. Within distance <6 of any nonempty cell
// 2. In a line (direction) that contains another nonempty cell
function getWitnessedHexes() {
    const witnessed = new Set();
    const WITNESS_DISTANCE = 6;
    
    // For each nonempty cell, check all 6 directions
    for (const [key, tile] of gameState.tiles) {
        const [q, r] = key.split(',').map(Number);
        
        // Check each direction from this nonempty cell
        for (const dir of window.HEX_DIRECTIONS) {
            // Go up to WITNESS_DISTANCE-1 cells in this direction
            for (let dist = 1; dist < WITNESS_DISTANCE; dist++) {
                const targetQ = q + dir.q * dist;
                const targetR = r + dir.r * dist;
                
                // Only add if it's empty and within render horizon
                if (isHexEmpty(targetQ, targetR) && isInRenderHorizon(targetQ, targetR)) {
                    witnessed.add(getHexKey(targetQ, targetR));
                }
            }
        }
    }
    
    return Array.from(witnessed).map(key => {
        const [q, r] = key.split(',').map(Number);
        return { q, r };
    });
}

// Get all lines of 6 that intersect a given hex
function getLinesIntersectingHex(q, r) {
    const lines = [];
    
    // Check all 6 directions - each direction defines a line through the hex
    for (const dir of window.HEX_DIRECTIONS) {
        // Build a complete line in this direction using the existing buildLine function
        // This creates a line of WINNING_LENGTH*2 = 12 hexes
        const fullLine = window.buildLine(q, r, dir.q, dir.r);
        
        if (fullLine.length < window.WINNING_LENGTH) continue;
        
        // Check all sliding windows of WINNING_LENGTH hexes
        for (let i = 0; i <= fullLine.length - window.WINNING_LENGTH; i++) {
            const hexWindow = fullLine.slice(i, i + window.WINNING_LENGTH);
            
            // Check if this window contains the target hex
            const containsTarget = hexWindow.some(h => h.q === q && h.r === r);
            if (containsTarget) {
                // Convert to simple {q, r} format (without tile property)
                lines.push(hexWindow.map(h => ({ q: h.q, r: h.r })));
            }
        }
    }
    
    return lines;
}

// Check if a line is valid (doesn't have cells belonging to both players)
// Returns: { valid: boolean, cpuCount: number, emptyCount: number }
function analyzeLine(line, cpuPlayer) {
    const opponentPlayer = cpuPlayer === 1 ? 2 : 1;
    
    let cpuCount = 0;
    let opponentCount = 0;
    let emptyCount = 0;
    
    for (const hex of line) {
        const tile = gameState.tiles.get(getHexKey(hex.q, hex.r));
        if (tile === cpuPlayer) {
            cpuCount++;
        } else if (tile === opponentPlayer) {
            opponentCount++;
        } else {
            emptyCount++;
        }
    }
    
    // Line is valid if it doesn't have cells from both players
    const valid = (opponentCount === 0 || cpuCount === 0);
    
    return { valid, cpuCount, opponentCount, emptyCount };
}

// Score a hex based on all lines that intersect it
function scoreHex(q, r, cpuPlayer) {
    const lines = getLinesIntersectingHex(q, r);
    let score = 0;
    
    for (const line of lines) {
        const analysis = analyzeLine(line, cpuPlayer);
        
        if (analysis.valid) {
            // evaluation heuristic
            score += analysis.opponentCount;
            score += analysis.cpuCount * 0.9;
            if (analysis.opponentCount == 0) score += 0.1;
        }
    }
    
    return score;
}

// Simplified winning move detection using threat logic
function findWinningMove(cpuPlayer) {
    // Determine how many moves CPU has left this turn
    const mod = gameState.moveCount % 4;
    let cpuMovesLeft = 0;
    
    if (cpuPlayer === 1) {
        cpuMovesLeft = (mod === 3) ? 2 : 1; // 3, 0
    } else {
        cpuMovesLeft = (mod === 1) ? 2 : 1; // 1, 2
    }
    
    // Get CPU's threats using the existing checkThreat function
    const threats = checkThreat();
    const cpuThreats = cpuPlayer === 1 ? threats.player1 : threats.player2;
    
    // If CPU has 2 moves left:
    // - Any threat (4+ tiles) means we can win in 2 moves
    // If CPU has 1 move left:
    // - Need a threat with 5 tiles to win immediately
    if (cpuThreats && cpuThreats.length > 0) {
        if (cpuMovesLeft >= 2) {
            // Any threat means we can win - find a move that completes one
            return findMoveToCompleteThreat(cpuPlayer, cpuThreats);
        } else if (cpuMovesLeft === 1) {
            // Only win if we have a threat with 5 tiles (immediate win)
            for (const threatLine of cpuThreats) {
                let cpuCount = 0;
                for (const hex of threatLine) {
                    const tile = gameState.tiles.get(getHexKey(hex.q, hex.r));
                    if (tile === cpuPlayer) cpuCount++;
                }
                if (cpuCount >= 5) {
                    return findMoveToCompleteThreat(cpuPlayer, cpuThreats);
                }
            }
        }
    }
    
    return null;
}

// Find a move that completes one of the CPU's threats
function findMoveToCompleteThreat(cpuPlayer, cpuThreats) {
    const witnessed = getWitnessedHexes();
    
    // First try to find an immediate win
    for (const hex of witnessed) {
        gameState.tiles.set(getHexKey(hex.q, hex.r), cpuPlayer);
        const winningLine = checkWin(cpuPlayer);
        gameState.tiles.delete(getHexKey(hex.q, hex.r));
        
        if (winningLine) {
            return hex;
        }
    }
    
    // Otherwise find any empty cell in a threat line
    for (const threatLine of cpuThreats) {
        for (const hex of threatLine) {
            if (isHexEmpty(hex.q, hex.r) && isInRenderHorizon(hex.q, hex.r)) {
                return { q: hex.q, r: hex.r };
            }
        }
    }
    
    return null;
}

// Check if opponent can win on their next turn (immediate threat)
// Returns true if opponent has a line with 4+ tiles and can complete a win
function checkOpponentCanWinNextTurn(player) {
    // Check for any line where player has 4+ tiles (could win in 2 moves)
    // or 5+ tiles (could win in 1 move)
    for (const [key, tile] of gameState.tiles) {
        if (tile !== player) continue;
        
        const [q, r] = key.split(',').map(Number);
        
        for (const dir of window.HEX_DIRECTIONS) {
            const line = window.buildLine(q, r, dir.q, dir.r);
            
            if (line.length < window.WINNING_LENGTH) continue;
            
            for (let i = 0; i <= line.length - window.WINNING_LENGTH; i++) {
                const hexWindow = line.slice(i, i + window.WINNING_LENGTH);
                
                // Skip empty lines
                if (!hexWindow.some(h => h.tile !== undefined)) continue;
                
                let playerCount = 0;
                let emptyCount = 0;
                
                for (const h of hexWindow) {
                    if (h.tile === player) playerCount++;
                    else if (h.tile === undefined) emptyCount++;
                }
                
                // Player can win next turn with 5+ tiles and 1+ empty (1 move)
                // Or with 4+ tiles and 2+ empty (2 moves - but we treat as threat)
                if ((playerCount >= 5 && emptyCount >= 1) || 
                    (playerCount >= 4 && emptyCount >= 2)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// Check for threats and find blocking moves - prefers blocking multiple threats
function findBlockingMove(cpuPlayer, opponentPlayer) {
    // Check for opponent's winning threats
    const threats = checkThreat();
    const opponentThreats = opponentPlayer === 1 ? threats.player1 : threats.player2;
    
    if (!opponentThreats || opponentThreats.length === 0) {
        return null;
    }
    
    // Collect all empty cells in all threat lines
    const threatEmptyCells = new Map(); // key: "q,r" -> count of threats blocked
    
    for (const threatLine of opponentThreats) {
        for (const hex of threatLine) {
            const key = getHexKey(hex.q, hex.r);
            // Only add if this hex is NOT occupied by either player
            const tile = gameState.tiles.get(key);
            if (tile === undefined) {
                // This cell is empty and can be used to block
                if (threatEmptyCells.has(key)) {
                    threatEmptyCells.set(key, threatEmptyCells.get(key) + 1);
                } else {
                    threatEmptyCells.set(key, 1);
                }
            }
            // If tile === cpuPlayer, we can't block there (already ours)
            // If tile === opponentPlayer, they already have that cell
        }
    }
    
    // If no empty cells found in threat lines, we can't block
    if (threatEmptyCells.size === 0) {
        return null;
    }
    
    // Find the empty cell that blocks the most threats
    let bestBlocker = null;
    let maxThreatsBlocked = 0;
    
    for (const [key, threatCount] of threatEmptyCells) {
        const [q, r] = key.split(',').map(Number);
        
        if (threatCount > maxThreatsBlocked) {
            maxThreatsBlocked = threatCount;
            bestBlocker = { q, r };
        }
    }
    
    // Verify the best blocker is a valid empty cell
    if (bestBlocker) {
        const tile = gameState.tiles.get(getHexKey(bestBlocker.q, bestBlocker.r));
        if (tile !== undefined) {
            // Best blocker is not actually empty, search for any empty cell in threats
            for (const [key] of threatEmptyCells) {
                const [q, r] = key.split(',').map(Number);
                const checkTile = gameState.tiles.get(getHexKey(q, r));
                if (checkTile === undefined) {
                    return { q, r };
                }
            }
            return null;
        }
    }
    
    return bestBlocker;
}

// Main CPU move function
function makeCPUMove() {
    // Check if game is over
    if (gameState.gamePhase === 'gameOver') {
        return false;
    }
    
    // If viewing a historical position, rebuild to that point first
    if (moveHistoryTree.currentNode && moveHistoryTree.currentNode !== getLatestNode()) {
        rebuildGameState(moveHistoryTree.currentNode);
    }
    
    const cpuPlayer = getCurrentPlayer();
    const opponentPlayer = cpuPlayer === 1 ? 2 : 1;
    
    // Special case: Initial phase - only center (0,0) is legal
    if (gameState.gamePhase === 'initial') {
        if (isHexEmpty(0, 0) && isInRenderHorizon(0, 0)) {
            return handleTilePlacement(0, 0);
        }
        return false;
    }
    
    // Priority 1: Check if CPU can win immediately
    const winningMove = findWinningMove(cpuPlayer);
    
    if (winningMove) {
        return handleTilePlacement(winningMove.q, winningMove.r);
    }
    
    // Priority 2: Block opponent's winning move
    // ALWAYS check for blocking when there's no winning move - this is critical!
    // First check if opponent can win immediately
    const opponentCanWinNow = checkOpponentCanWinNextTurn(opponentPlayer);
    
    // Also check threats using the standard threat detection
    const threats = checkThreat();
    const opponentThreats = opponentPlayer === 1 ? threats.player1 : threats.player2;
    const hasThreats = opponentThreats && opponentThreats.length > 0;
    
    // Block if opponent can win NOW or if there are any detected threats
    if (opponentCanWinNow || hasThreats) {
        // Try primary blocking first
        const blockingMove = findBlockingMove(cpuPlayer, opponentPlayer);
        
        if (blockingMove) {
            return handleTilePlacement(blockingMove.q, blockingMove.r);
        }
    }
    
    // Priority 3: Evaluate all witnessed hexes and choose best score
    const witnessed = getWitnessedHexes();
    let bestScore = -1;
    let bestHex = null;
    
    for (const hex of witnessed) {
        const score = scoreHex(hex.q, hex.r, cpuPlayer);
        
        if (score > bestScore) {
            bestScore = score;
            bestHex = hex;
        }
    }
    
    if (bestHex) {
        return handleTilePlacement(bestHex.q, bestHex.r);
    }
    
    return false;
}

// Export to browser window
if (typeof window !== 'undefined') {
    window.getWitnessedHexes = getWitnessedHexes;
    window.getLinesIntersectingHex = getLinesIntersectingHex;
    window.analyzeLine = analyzeLine;
    window.scoreHex = scoreHex;
    window.findWinningMove = findWinningMove;
    window.findBlockingMove = findBlockingMove;
    window.checkOpponentCanWinNextTurn = checkOpponentCanWinNextTurn;
    window.makeCPUMove = makeCPUMove;
}
