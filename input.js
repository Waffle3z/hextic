// Input Event Handlers

let lastTouchDist = 0;

// Setup all event listeners
function setupEventListeners() {
	if (!canvas) return;
	
	window.addEventListener('resize', resizeCanvas);
	
	// Handle copy/paste events - works across all platforms (Ctrl+C/Cmd+C, right-click, menus)
	document.addEventListener('copy', (e) => {
		e.preventDefault();
		copyGameTreeToClipboard();
	});
	
	document.addEventListener('paste', (e) => {
		e.preventDefault();
		pasteGameTreeFromClipboard();
	});
	
	// Mouse events for canvas
	canvas.addEventListener('mousedown', handleMouseDown);
	canvas.addEventListener('mousemove', handleMouseMove);
	canvas.addEventListener('mouseup', handleMouseUp);
	canvas.addEventListener('mouseleave', handleMouseLeave);
	canvas.addEventListener('wheel', handleWheel, { passive: false });
	
	// Touch events for mobile
	canvas.addEventListener('touchstart', handleTouchStart);
	canvas.addEventListener('touchmove', handleTouchMove);
	canvas.addEventListener('touchend', handleTouchEnd);
	
	// Prevent context menu (including paste option) on canvas
	canvas.addEventListener('contextmenu', (e) => e.preventDefault());
	
	// Navigation buttons
	if (prevBtn) prevBtn.addEventListener('click', goToPreviousMove);
	if (nextBtn) nextBtn.addEventListener('click', goToNextMove);
	
	// Coordinates toggle button
	if (coordsBtn) coordsBtn.addEventListener('click', toggleCoordinates);
	
	// CPU move button
	if (cpuBtn) cpuBtn.addEventListener('click', handleCPUMove);
	
	// Toggle threats button
	if (threatsBtn) threatsBtn.addEventListener('click', toggleThreats);
	
	// Auto-move toggle button
	if (autoMoveBtn) autoMoveBtn.addEventListener('click', toggleAutoMove);
	
	// Hamburger menu
	if (menuBtn) menuBtn.addEventListener('click', toggleHamburgerMenu);
	if (restartBtn) restartBtn.addEventListener('click', handleRestartClick);
	if (copyBtn) copyBtn.addEventListener('click', handleCopyClick);
	if (pasteBtn) pasteBtn.addEventListener('click', handlePasteClick);
	if (hamburgerMenu) {
		hamburgerMenu.addEventListener('contextmenu', (e) => e.preventDefault());
	}
	
	// Close hamburger menu when clicking outside
	document.addEventListener('click', (e) => {
		if (hamburgerMenu && hamburgerMenu.classList.contains('hidden') === false) {
			if (!hamburgerMenu.contains(e.target) && !menuBtn.contains(e.target)) {
				hamburgerMenu.classList.add('hidden');
			}
		}
	});
	
	// Prevent context menu on hamburger menu items
	if (hamburgerMenu) {
		hamburgerMenu.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
	}
	
	// Also close when clicking menu button again
	if (menuBtn) {
		menuBtn.addEventListener('click', (e) => {
			e.stopPropagation();
		});
	}
}

// Mouse event handlers
function handleMouseDown(e) {
	if (e.button === 0) { // Left click
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		viewState.isDragging = true;
		viewState.dragStartX = x;
		viewState.dragStartY = y;
		viewState.offsetStartX = viewState.offsetX;
		viewState.offsetStartY = viewState.offsetY;
	}
}

function handleMouseMove(e) {
	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	
	if (viewState.isDragging) {
		viewState.offsetX = viewState.offsetStartX + (x - viewState.dragStartX);
		viewState.offsetY = viewState.offsetStartY + (y - viewState.dragStartY);
		render();
	}
	
	// Update hover state
	const hex = screenToHex(x, y, viewState.offsetX, viewState.offsetY, viewState.zoom);
	if (!hoverState.hex || hex.q !== hoverState.hex.q || hex.r !== hoverState.hex.r) {
		hoverState.hex = hex;
		hoverState.isHovering = true;
		render();
	}
}

function handleMouseUp(e) {
	if (viewState.isDragging) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		// Check if it was a click (not a drag)
		const dx = Math.abs(x - viewState.dragStartX);
		const dy = Math.abs(y - viewState.dragStartY);
		
		if (dx < 5 && dy < 5) {
			// It's a click, try to place a tile
			const hex = screenToHex(x, y, viewState.offsetX, viewState.offsetY, viewState.zoom);
			handleTilePlacement(hex.q, hex.r);
		}
		
		viewState.isDragging = false;
		render();
	}
}

function handleMouseLeave() {
	viewState.isDragging = false;
	hoverState.hex = null;
	hoverState.isHovering = false;
	render();
}

function handleWheel(e) {
	e.preventDefault();
	
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	
	const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
	const oldZoom = viewState.zoom;
	const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * zoomFactor));
	
	if (newZoom !== oldZoom) {
		// Calculate world position under mouse before zoom change
		const worldX = (mouseX - viewState.offsetX) / oldZoom;
		const worldY = (mouseY - viewState.offsetY) / oldZoom;
		
		viewState.zoom = newZoom;
		
		// Adjust offset so world position under mouse stays constant
		viewState.offsetX = mouseX - worldX * newZoom;
		viewState.offsetY = mouseY - worldY * newZoom;
		
		render();
	}
}

// Touch event handlers
function handleTouchStart(e) {
	e.preventDefault(); // Prevent default touch behavior
	
	if (e.touches.length === 1) {
		const touch = e.touches[0];
		const rect = canvas.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		const y = touch.clientY - rect.top;
		
		viewState.isDragging = true;
		viewState.dragStartX = x;
		viewState.dragStartY = y;
		viewState.offsetStartX = viewState.offsetX;
		viewState.offsetStartY = viewState.offsetY;
		
		// Store initial touch position for tap detection
		viewState.touchStartX = x;
		viewState.touchStartY = y;
	} else if (e.touches.length === 2) {
		lastTouchDist = getTouchDistance(e.touches);
		// Reset tap detection when pinch starts
		viewState.touchStartX = null;
		viewState.touchStartY = null;
	}
}

function handleTouchMove(e) {
	e.preventDefault();
	
	if (e.touches.length === 1 && viewState.isDragging) {
		const touch = e.touches[0];
		const rect = canvas.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		const y = touch.clientY - rect.top;
		
		viewState.offsetX = viewState.offsetStartX + (x - viewState.dragStartX);
		viewState.offsetY = viewState.offsetStartY + (y - viewState.dragStartY);
		render();
	} else if (e.touches.length === 2) {
		const dist = getTouchDistance(e.touches);
		if (lastTouchDist > 0) {
			const factor = dist / lastTouchDist;
			const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewState.zoom * factor));
			viewState.zoom = newZoom;
			render();
		}
		lastTouchDist = dist;
	}
}

function handleTouchEnd(e) {
	e.preventDefault(); // Prevent default touch behavior
	
	if (e.touches.length === 0) {
		// Check for tap gesture (single touch, minimal movement)
		if (viewState.touchStartX !== null && viewState.touchStartY !== null) {
			const touch = e.changedTouches[0];
			const rect = canvas.getBoundingClientRect();
			const endX = touch.clientX - rect.left;
			const endY = touch.clientY - rect.top;
			
			// Calculate movement distance
			const dx = Math.abs(endX - viewState.touchStartX);
			const dy = Math.abs(endY - viewState.touchStartY);
			const dist = Math.sqrt(dx * dx + dy * dy);
			
			// If movement is small enough, treat as tap
			if (dist < 10) {
				const hex = screenToHex(endX, endY, viewState.offsetX, viewState.offsetY, viewState.zoom);
				handleTilePlacement(hex.q, hex.r);
			}
		}
		
		viewState.isDragging = false;
		viewState.touchStartX = null;
		viewState.touchStartY = null;
		lastTouchDist = 0;
	} else if (e.touches.length === 1 && lastTouchDist > 0) {
		// Transitioning from pinch to drag - start dragging with remaining finger
		const touch = e.touches[0];
		const rect = canvas.getBoundingClientRect();
		viewState.dragStartX = touch.clientX - rect.left;
		viewState.dragStartY = touch.clientY - rect.top;
		viewState.offsetStartX = viewState.offsetX;
		viewState.offsetStartY = viewState.offsetY;
		viewState.isDragging = true;
		lastTouchDist = 0;
		// Reset tap detection
		viewState.touchStartX = null;
		viewState.touchStartY = null;
	}
}

function getTouchDistance(touches) {
	const dx = touches[0].clientX - touches[1].clientX;
	const dy = touches[0].clientY - touches[1].clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

// Handle tile placement - called from mouse/touch handlers and CPU
// skipAutoMove: if true, skip the checkAndAutoMove call (used when CPU makes multiple moves)
function handleTilePlacement(q, r, skipAutoMove = false) {
	const success = placeTile(q, r);
	if (success) {
		updateUI();
		// Always check for auto-move (enables CPU's second move in a turn)
		// Unless skipAutoMove is true (CPU is making multiple moves in sequence)
		if (!skipAutoMove) {
			checkAndAutoMove();
		}
	}
	return success;
}

// Resize canvas to fit container
function resizeCanvas() {
	if (!canvas || !canvas.parentElement) return;
	const container = canvas.parentElement;
	canvas.width = container.clientWidth;
	canvas.height = container.clientHeight;
	render();
}

// Center view on specific hex coordinates
function centerOn(q, r) {
	if (!canvas) return;
	const centerX = canvas.width / 2;
	const centerY = canvas.height / 2;
	// hexToPixel already applies zoom internally, so don't multiply again
	const hexPos = hexToPixel(q, r, viewState.zoom);
	viewState.offsetX = centerX - hexPos.x;
	viewState.offsetY = centerY - hexPos.y;
}

// Toggle coordinates display
function toggleCoordinates() {
	viewState.showCoordinates = !viewState.showCoordinates;
	if (coordsBtn) {
		coordsBtn.classList.toggle('active', viewState.showCoordinates);
	}
	render();
}

// Toggle threat warnings display
function toggleThreats() {
	viewState.showThreats = !viewState.showThreats;
	if (threatsBtn) {
		threatsBtn.classList.toggle('active', viewState.showThreats);
	}
	render();
}

// Handle CPU move
function handleCPUMove() {
	// Need to wait for cpu-player.js to be loaded
	if (typeof makeCPUMove === 'function') {
		const moved = makeCPUMove();
		if (moved) {
			updateUI();
			render();
			// Don't call checkAndAutoMove here - that creates a loop
			// Auto-move only triggers after MANUAL tile placement, not CPU button clicks
		}
	}
}

// Toggle auto-move for the current player
function toggleAutoMove() {
	const currentPlayer = getCurrentPlayer();
	
	// If disabled, enable for current player
	// If enabled, disable (toggle off)
	if (autoMoveState.enabledPlayer === 0) {
		autoMoveState.enabledPlayer = currentPlayer;
	} else {
		autoMoveState.enabledPlayer = 0;
	}
	
	// Update button appearance
	updateAutoMoveButton();
	
	// If auto-move is now enabled and it's that player's turn, make a move
	if (autoMoveState.enabledPlayer !== 0 && autoMoveState.enabledPlayer === getCurrentPlayer()) {
		checkAndAutoMove();
	}
}

// Handle copy button click
function handleCopyClick() {
	copyGameTreeToClipboard();
	toggleHamburgerMenu();
}

// Handle paste button click
function handlePasteClick(e) {
	e.preventDefault();
	e.stopPropagation();
	hamburgerMenu.classList.add('hidden');
	pasteGameTreeFromClipboard();
	return false;
}

// Handle restart button in hamburger menu
function handleRestartClick() {
	restartGame();
	toggleHamburgerMenu();
}

// Toggle hamburger menu
function toggleHamburgerMenu() {
	if (hamburgerMenu) {
		hamburgerMenu.classList.toggle('hidden');
	}
}

// Update auto-move button appearance
function updateAutoMoveButton() {
	if (!autoMoveBtn) return;
	
	if (autoMoveState.enabledPlayer === 0) {
		autoMoveBtn.textContent = 'Auto';
		autoMoveBtn.classList.remove('active', 'player-1', 'player-2');
	} else if (autoMoveState.enabledPlayer === 1) {
		autoMoveBtn.textContent = 'Auto P1';
		autoMoveBtn.classList.add('active', 'player-1');
		autoMoveBtn.classList.remove('player-2');
	} else if (autoMoveState.enabledPlayer === 2) {
		autoMoveBtn.textContent = 'Auto P2';
		autoMoveBtn.classList.add('active', 'player-2');
		autoMoveBtn.classList.remove('player-1');
	}
}

// Check if auto-move should trigger and execute it
function checkAndAutoMove() {
	if (autoMoveState.enabledPlayer !== 0 && 
		autoMoveState.enabledPlayer === getCurrentPlayer() &&
		gameState.gamePhase !== 'gameOver') {
		setTimeout(() => {
			handleCPUMove();
		}, 100);
	}
}

// Export to browser window
if (typeof window !== 'undefined') {
	window.setupEventListeners = setupEventListeners;
	window.centerOn = centerOn;
	window.checkAndAutoMove = checkAndAutoMove;
	window.updateAutoMoveButton = updateAutoMoveButton;
}
