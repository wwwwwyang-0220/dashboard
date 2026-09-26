# Library

The main part of a project page: notes and images, grouped by date, newest first. A capture box on top adds notes; images come in by the Add image button, paste, or drop.

## Sub-features

- `quick-note`: type in "Write a note…" and press ⌘Enter or Save.
- `add-image`: Add image button (file picker), paste into the note box, or drop onto it. PNG, JPEG, GIF, WebP up to 25 MB.
- `date-groups`: Today, Yesterday, one group per day for the past week, then one per month.
- `filter`: All / Notes / Images with counts.
- `focus`: clicking a card opens it large; title and note text save as you type; Esc or Close returns.
- `select`: the check on a card, or Select in the header; then a bar offers Delete, Add to board, Compare on a new board.
- `context-menu`: right-click (long-press on touch) a card for Open, Select, Add to board, Delete.
- `delete`: asks for confirmation and also takes the item off any boards.
- `empty`: a hint to write a note or drop an image when the project has no items.

## How to get to it (user POV)

The **Library** section of any project page.

## Driving it with control-dashboard

- Note: `fill --label "New note" --value "Pilot showed ceiling effects"`, `press Meta+Enter --label "New note"`. A card appears under Today.
- Image: `upload --role button --name "Add image" --file .claude/skills/verify-dashboard/fixtures/upload.png`. A new image card; a new file in `/tmp/dashboard-verify/data/files/`.
- Focus edit: `click --role button --name "Note · Sep 18 Method notes Participants read short passages and answer comprehension questions."`, then `fill --label Title --exact --value "Methods"`, `press Escape`. Proof after `reload`: the card title and `data` both read "Methods".
- Filter: `click --role button --name "Images 1"`; only the image card remains.
- Select: `click --role button --name "Select Method notes"`; `snapshot --role toolbar --name "Selected items"` shows "1 selected".
- Delete via menu: `click --text "Remember to counterbalance" --right`, `click --role menuitem --name Delete --dialog accept`. Drive once with the default (dismiss) too: nothing should change.
- Empty: `open "/?project=verify-beta"`, `snapshot --css .library`.

## Gotchas

- Card buttons are named by their whole visible text (kind, date, title, preview). Use `snapshot --css .library-stream` to copy the exact name, or `--css '[data-item-id="note-method"] .library-card-open'`.
- Focus edits save 0.8 s after typing stops or on close. Close the dialog before `reload`.
- Paste and drag-and-drop of real files are not driven by this CLI; `upload` covers the same upload path through the file picker.
- Deleting an item that is on a board changes the board too: check `boards` in `data`.
