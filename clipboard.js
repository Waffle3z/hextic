// Game Tree Clipboard Import/Export
// Uses pairing functions to serialize hex coordinates as natural numbers

// Serialize the game tree to nested array format
function serializeGameTree() {
    if (!moveHistoryTree.root) {
        return null;
    }
    
    function serializeNode(node) {
        if (!node) return null;
        
        const packedCoord = hexToNat(node.q, node.r);
        
        if (node.children.length === 0) {
            return packedCoord;
        }
        
        if (node.children.length === 1) {
            const childResult = serializeNode(node.children[0]);
            if (typeof childResult === 'number') {
                return [packedCoord, childResult];
            }
            return [packedCoord, ...childResult];
        }
        
        const result = [packedCoord];
        for (const child of node.children) {
            result.push(serializeNode(child));
        }
        
        return result;
    }
    
    const serialized = serializeNode(moveHistoryTree.root);
    
    // Find the position of current focus in the serialized format
    let focusIndex = -1;
    let currentIndex = 0;
    
    function findSerializedPosition(node, target) {
        if (!node) return -1;
        
        if (node === target) {
            return currentIndex;
        }
        currentIndex++;
        
        for (const child of node.children) {
            const result = findSerializedPosition(child, target);
            if (result >= 0) return result;
        }
        return -1;
    }
    
    if (moveHistoryTree.currentNode) {
        currentIndex = 0;
        focusIndex = findSerializedPosition(moveHistoryTree.root, moveHistoryTree.currentNode);
    }
    
    // Build the output string
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

// Rebuild the game tree from nested array format
function rebuildGameTreeFromSerialized(data, focusIndex = -1) {
    if (!data || !Array.isArray(data)) {
        return false;
    }
    
    const savedOffsetX = viewState.offsetX;
    const savedOffsetY = viewState.offsetY;
    const savedZoom = viewState.zoom;
    
    resetGameState();
    
    const nodeStack = [];
    processSerializedArray(data, nodeStack);
    
    // Find target node based on focus index in serialized format
    let targetNode = null;
    
    if (focusIndex >= 0) {
        // Find node at the specified position in serialized format
        let currentIndex = 0;
        
        function findNodeAtPosition(node, targetPos) {
            if (!node) return null;
            
            if (currentIndex === targetPos) {
                return node;
            }
            currentIndex++;
            
            for (const child of node.children) {
                const result = findNodeAtPosition(child, targetPos);
                if (result) return result;
            }
            return null;
        }
        
        currentIndex = 0;
        targetNode = findNodeAtPosition(moveHistoryTree.root, focusIndex);
    }
    

    
    if (targetNode) {
        goToMove(targetNode);
    }
    
    viewState.offsetX = savedOffsetX;
    viewState.offsetY = savedOffsetY;
    viewState.zoom = savedZoom;
    
    return true;
}

function processSerializedArray(arr, nodeStack) {
    if (!arr || !Array.isArray(arr)) return;
    
    for (const item of arr) {
        if (typeof item === 'number') {
            const coords = natToHex(item);
            placeTile(coords.q, coords.r);
        } else if (Array.isArray(item)) {
            nodeStack.push(moveHistoryTree.currentNode);
            processSerializedArray(item, nodeStack);
            const popped = nodeStack.pop();
            goToMove(popped);
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
    window.serializeGameTree = serializeGameTree;
    window.deserializeGameTree = deserializeGameTree;
    window.rebuildGameTreeFromSerialized = rebuildGameTreeFromSerialized;
    window.copyGameTreeToClipboard = copyGameTreeToClipboard;
    window.pasteGameTreeFromClipboard = pasteGameTreeFromClipboard;
}
