// Game Analysis - Board state, threat detection, and line analysis

function getAllLines(tiles) {
	const lines = [];
	const checkedWindows = new Set();
	
	for (const [key, tile] of tiles) {
		const [q, r] = key.split(',').map(Number);
		
		for (const dir of window.HEX_DIRECTIONS) {
			const line = buildLineWithTiles(tiles, q, r, dir.q, dir.r);
			
			if (line.length < window.WINNING_LENGTH) continue;
			
			for (let i = 0; i <= line.length - window.WINNING_LENGTH; i++) {
				const hexWindow = line.slice(i, i + window.WINNING_LENGTH);
				
				const first = hexWindow[0];
				const last = hexWindow[window.WINNING_LENGTH - 1];
				const lineKey = `${first.q},${first.r}-${last.q},${last.r}`;
				
				if (checkedWindows.has(lineKey)) continue;
				checkedWindows.add(lineKey);
				
				let player1Count = 0;
				let player2Count = 0;
				
				for (const h of hexWindow) {
					if (h.tile === 1) player1Count++;
					else if (h.tile === 2) player2Count++;
				}
				
				if (player1Count === 0 || player2Count === 0) {
					lines.push({
						hexes: hexWindow,
						player1Count,
						player2Count,
						player: player1Count > 0 ? 1 : (player2Count > 0 ? 2 : 0)
					});
				}
			}
		}
	}
	
	return lines;
}

function getPreemptiveLines(tiles, player) {
	const lines = getAllLines(tiles);
	const preemptives = [];
	
	for (const line of lines) {
		const { player1Count, player2Count, player: linePlayer } = line;
		if (linePlayer !== player) continue;
		
		const playerCount = player === 1 ? player1Count : player2Count;
		if (playerCount >= 2 && playerCount <= 5) {
			preemptives.push(line);
		}
	}
	
	return preemptives;
}

function getMoveCandidates(tiles) {
	const witnessed = new Set();
	const WITNESS_DISTANCE = window.WINNING_LENGTH;
	
	for (const [key, tile] of tiles) {
		const [q, r] = key.split(',').map(Number);
		
		for (const dir of window.HEX_DIRECTIONS) {
			for (let dist = 1; dist < WITNESS_DISTANCE; dist++) {
				const targetQ = q + dir.q * dist;
				const targetR = r + dir.r * dist;
				
				if (!tiles.has(getHexKey(targetQ, targetR))) {
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

function getMovesLeftInTurn(player) {
	const mod = gameState.moveCount % 4;
	return (player === 1) ? ((mod === 3) ? 2 : 1) : ((mod === 1) ? 2 : 1);
}

function buildLineWithTiles(tiles, startQ, startR, dq, dr) {
	const line = [];
	const buildDistance = window.WINNING_LENGTH;
	const bufferSize = buildDistance * 2;
	
	let currQ = startQ - dq * buildDistance;
	let currR = startR - dr * buildDistance;
	
	for (let i = 0; i < bufferSize; i++) {
		const tile = tiles.get(getHexKey(currQ, currR));
		line.push({ q: currQ, r: currR, tile: tile });
		currQ += dq;
		currR += dr;
	}
	
	return line;
}

function makeTempMove(tiles, q, r, player) {
	tiles.set(getHexKey(q, r), player);
}

function undoTempMove(tiles, q, r) {
	tiles.delete(getHexKey(q, r));
}

function getForcedFirstMove(cpuPlayer) {
	const movesLeft = getMovesLeftInTurn(cpuPlayer);
	if (movesLeft === 2) return null;
	
	const latestNode = getLatestNode();
	if (!latestNode) return null;
	
	let node = latestNode;
	while (node) {
		if (node.player === cpuPlayer) {
			return { q: node.q, r: node.r };
		}
		node = node.parent;
	}
	return null;
}

if (typeof window !== 'undefined') {
	window.getAllLines = getAllLines;
	window.getPreemptiveLines = getPreemptiveLines;
	window.getMoveCandidates = getMoveCandidates;
	window.getMovesLeftInTurn = getMovesLeftInTurn;
	window.buildLineWithTiles = buildLineWithTiles;
	window.makeTempMove = makeTempMove;
	window.undoTempMove = undoTempMove;
	window.getForcedFirstMove = getForcedFirstMove;
}
