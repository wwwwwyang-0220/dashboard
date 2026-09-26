# Boards

A board lays chosen notes and images side by side on a 24-column grid for comparison and keeps that arrangement. Opening one hides the sidebar for focus.

## Sub-features

- `create`: Compare on a new board from a library selection, or New board in the Boards list (empty board).
- `open`: the Boards list on a project page, most recently edited first, with a Continue mark.
- `rename`: the board name at the top; saves on Enter or leaving the field.
- `arrange`: drag a card by its bar, resize from the corner; keyboard: focus the move or resize handle and use arrow keys.
- `drawer`: Show library opens a side drawer to add items or a new note to this board.
- `remove-card`: a card's options button offers Remove from board (the item stays in the library).
- `delete-board`: Board options → Delete board, with confirmation; items stay in the library.
- `board-search`: ⌘K on a board finds library items to add.

## How to get to it (user POV)

On a project page, select two items and choose **Compare on a new board**, or click a board under **Boards**. The back button at the top left returns to the project.

## Driving it with control-dashboard

- Create: `click --role button --name "Select Method notes"`, `click --role button --name "Select Reading times by condition"`, `click --role button --name "Compare on a new board"`. `url` gains `board=`; the toolbar says "2 items".
- Open existing: `click --role button --name "Method vs results 2 items · edited Sep 19 Continue"` (copy the name from `snapshot --css .boards`), or `click --css .board-row --nth 0` for the most recent.
- Rename: `fill --label "Board name" --value "Ceiling check"`, `press Enter --label "Board name"`.
- Arrange: `press ArrowDown --role button --name "Move Method notes. Use arrow keys to move by one grid step."`; check the card's `y` in `data`.
- Drawer: `click --role button --name "Show library"`, then `click --role button --name "Add Remember to counterbalance passage order. to board"`. The card appears; `data` lists `note-untitled` in the board's cards.
- Remove a card: `click --role button --name "Options for Reading times by condition"`, `click --role button --name "Remove from board"`. Gone from `cards`, still in `items`.
- Delete: `click --role button --name "Board options"`, `click --role button --name "Delete board" --dialog accept`. Returns to the project page; the board is gone from `data`, its items remain.
- Proof: `screenshot board-after-change`, `reload` (the board and layout come back), `data --project verify-alpha`.

## Gotchas

- A card will not move into space another card occupies; a blocked nudge looks like "nothing happened" but is correct.
- New boards size cards from the window width; card sizes differ between viewports, so compare positions within one viewport.
- Pointer dragging on a touch screen is untested on a real iPad.
