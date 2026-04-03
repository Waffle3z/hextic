// Game Tree Clipboard Import/Export
// Uses pairing functions to serialize hex coordinates as natural numbers

function serializeGameTree() {
	if (!moveHistoryTree.root) {
		return null;
	}
	
	function serializeNode(node) {
		if (!node) return null;
		
		const turnCoord = hexToNat(node.q, node.r);
		let result = [turnCoord];
		
		if (node.children.length > 0) {
			const mainChild = node.children[0];
			const childResult = serializeNode(mainChild);
			
			if (node.children.length === 1 && childResult) {
				result.push(...childResult);
			} else {
				for (const child of node.children) {
					const serialized = serializeNode(child);
					if (serialized) result.push(serialized);
				}
			}
		}
		
		return result;
	}
	
	const serialized = serializeNode(moveHistoryTree.root);
	
	let focusIndex = -1;
	if (moveHistoryTree.currentNode) {
		const positions = [];
		function traverse(node) {
			if (!node) return;
			positions.push(node);
			node.children.forEach(traverse);
		}
		traverse(moveHistoryTree.root);
		focusIndex = positions.indexOf(moveHistoryTree.currentNode);
	}
	
	let output = JSON.stringify(serialized);
	if (focusIndex >= 0) {
		output += ';' + focusIndex;
	}
	
	return output;
}

// Deserialize the nested array format
function deserializeGameTree(text) {
	if (!text || typeof text !== 'string') {
		return null;
	}
	
	// Check for focus index separator
	let treeText = text;
	let focusIndex = -1;
	
	const semicolonIndex = text.indexOf(';');
	if (semicolonIndex > 0) {
		treeText = text.substring(0, semicolonIndex);
		focusIndex = parseInt(text.substring(semicolonIndex + 1), 10);
	}
	
	let data;
	try {
		data = JSON.parse(treeText.trim());
	} catch (e) {
		console.error('Invalid clipboard format:', e);
		return null;
	}
	
	return { data: data, focusIndex: focusIndex };
}

function rebuildGameTreeFromSerialized(data, focusIndex = -1) {
	if (!data || !Array.isArray(data)) {
		return false;
	}
	
	const savedOffsetX = viewState.offsetX;
	const savedOffsetY = viewState.offsetY;
	const savedZoom = viewState.zoom;
	
	resetGameState();
	processSerializedArray(data);
	
	let targetNode = null;
	if (focusIndex >= 0) {
		const positions = [];
		function traverse(node) {
			if (!node) return;
			positions.push(node);
			node.children.forEach(traverse);
		}
		traverse(moveHistoryTree.root);
		targetNode = positions[focusIndex] || null;
	}
	
	if (targetNode) {
		goToMove(targetNode);
	}
	
	viewState.offsetX = savedOffsetX;
	viewState.offsetY = savedOffsetY;
	viewState.zoom = savedZoom;
	
	return true;
}

function processSerializedArray(arr) {
	if (!arr || !Array.isArray(arr)) return;
	
	for (const item of arr) {
		if (typeof item === 'number') {
			const coords = natToHex(item);
			placeTile(coords.q, coords.r);
		} else if (Array.isArray(item)) {
			const saved = moveHistoryTree.currentNode;
			processSerializedArray(item);
			moveHistoryTree.currentNode = saved;
		}
	}
}

async function copyGameTreeToClipboard() {
	const serialized = serializeGameTree();
	if (!serialized) {
		return false;
	}
	
	try {
		await navigator.clipboard.writeText(serialized);
		return true;
	} catch (err) {
		console.error('Copy failed:', err);
		return false;
	}
}

async function pasteGameTreeFromClipboard() {
	try {
		const text = await navigator.clipboard.readText();
		const parsed = deserializeGameTree(text);
		
		if (!parsed || !parsed.data) {
			return false;
		}
		
		return rebuildGameTreeFromSerialized(parsed.data, parsed.focusIndex);
	} catch (err) {
		console.error('Paste failed:', err);
		return false;
	}
}

if (typeof window !== 'undefined') {
	window.copyGameTreeToClipboard = copyGameTreeToClipboard;
	window.pasteGameTreeFromClipboard = pasteGameTreeFromClipboard;
}
