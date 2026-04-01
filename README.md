This is hexagonal tic-tac-toe.
The grid is unbounded in size.
Player 1 places a single hex first.
Then players make 2 consecutive moves at a time each turn.
The first player to connect 6 in a row of their own tiles wins.

The grid is effectively infinite, but only hexes within some distance of a placed tile are necessarily drawn.
The grid can be panned and zoomed in-out of. Clicking a hex places a tile.

The move history lists the coordinates of the hexes that have been placed in each move.
The position of the first placed tile is always (0, 0)

Like a chess explorer, the move history can be navigated and different branches can be explored and returned to.
A row in the move tree is created for every turn. A turn consists of 2 moves, except for the player 1's first turn which only has 1 move.
A row with one move made is updated when the second move of that turn is made.
When returning to a prior turn, if a different move is created, it creates a branch from the previous player's last turn.
If the different move is the second move of the turn, the first move of the turn is copied to the row where the branch starts.