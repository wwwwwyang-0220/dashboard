# Project workspace design

A calm tool for keeping one project's work in order. It should feel like a well-made native app — Things, Linear, Apple Notes — rather than a web form or a presentation: soft surfaces instead of outlines, one accent colour, a short type scale, generous and regular spacing, and quiet motion.

## Product structure

Each project is an organised cabinet, not an open canvas. Its page holds one to-do list, a library of notes and images, and a set of saved boards. The library is where the user spends most of the day, capturing short notes and images as they come, so it is the main surface. To-dos are visited at the start and end of the day, and boards are opened to compare or to continue earlier work; both stay visible in a rail beside the library. A board is where the user lays chosen library items side by side; it remembers its arrangement.

The accepted wireframes are in [Dashboard_V2](https://www.figma.com/design/47imLoFGQTJMkL3Mgy4tKU): 01 project page, 02 board at rest, 03 board with the library drawer while dragging, 04 resize snapping to a neighbour's size; 05 the library-first project page with the hover checkbox, 06 multiple selection, 07 a note in focus, 08 the card context menu, and 09 the library grouped by date; 10 a board with its name in the toolbar and the library panel closed, 11 the panel open, 12 an empty board, 13 board search, and 14 a searched item added at the middle. 05–09 supersede 01, and 10–14 supersede 02 and 03. They fix structure and behaviour; the visual values below supersede their colours and type sizes. Dashboard_V1 keeps the sidebar study and the retired free-canvas concept.

Design at a 1440 × 1024 CSS-pixel frame, then check 1024px and 820px (iPad portrait).

## Principles

- **Surfaces, not outlines.** The page is a warm off-white; content sits on slightly lighter cards separated by tone and a hairline, not by visible boxes around everything. Avoid pure white page backgrounds.
- **One accent.** A steady blue marks focus, selection, the primary action, and arrangement feedback. Red is only for destructive actions. Everything else is neutral.
- **A short scale for everything.** Type, spacing, radii, and shadows each come from the small sets below. If a value is not in a set, it needs a reason.
- **Quiet until needed.** Grids, guides, handles, and secondary buttons appear on hover, focus, or while arranging. On touch screens, controls stay visible.
- **Both themes are first-class.** Every colour comes from a token that has a light and a dark value.

## Tokens

All tokens are CSS custom properties defined in `src/index.css`. Components use tokens, never raw colours.

### Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#f6f5f2` | `#161719` | Main page surface |
| `--bg-sidebar` | `#efeee9` | `#121315` | Sidebar |
| `--surface` | `#fdfdfc` | `#1e2023` | Cards, inputs |
| `--surface-raised` | `#ffffff` | `#26282c` | Menus, dialogs |
| `--surface-well` | `#f1f0ec` | `#191a1d` | Board layout previews, thumbnails in lists |
| `--text-1` | `#1d2126` | `#ebecee` | Titles, primary text |
| `--text-2` | `#4a5059` | `#b9bdc4` | Body text |
| `--text-3` | `#666d77` | `#8c919a` | Secondary text, icons |
| `--text-4` | `#a4a9b0` | `#62666e` | Placeholders, disabled |
| `--line-1` | text-1 at 8% | white at 7% | Hairlines, card edges |
| `--line-2` | text-1 at 14% | white at 12% | Input edges, hover edges |
| `--fill-1/2/3` | text-1 at 4/7/10% | white at 5/8/11% | Hover, pressed, selected fills |
| `--accent` | `#2f5fc4` | `#7ea2ee` | Accent text, lines, focus |
| `--accent-fill` | `#3462c6` | `#3b69cf` | Primary button and checked background, white text on it |
| `--accent-soft` | accent at 10% | accent at 16% | Selection and landing preview fills |
| `--danger` | `#b8403a` | `#ef8078` | Destructive actions and errors |
| `--image-filter` | none | `brightness(0.86)` | Softens uploaded images, which often have white backgrounds, in dark mode |

Text on `--bg` and `--surface` meets WCAG AA: `--text-3` is for 12–13px secondary text and icons, not for body copy. `--text-4` is only for placeholders and disabled states.

### Type

The macOS system stack (`-apple-system`, SF Pro) with `PingFang SC` for Chinese. No web fonts. Numbers that change (counts) use tabular figures.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Page title | 28 / 34, tracking −0.02em | 600 |
| Dialog title | 20 / 26, tracking −0.01em | 600 |
| Section heading, reading text | 16 / 24 | 600 heading, 400 reading |
| Body, controls, to-dos | 14 / 20 | 400, 500 for emphasis |
| Secondary text | 13 / 18 | 400 |
| Captions, metadata | 12 / 16 | 400–500 |

### Spacing, radii, elevation

- Spacing uses 4, 8, 12, 16, 24, 32, 48. Page gutters are 32px; section gaps are 40–48px; items within a section are 8–16px apart.
- Radii: 6px for small controls inside cards, 8px for buttons and inputs, 12px for cards, 14px for dialogs.
- `--shadow-1` is a barely-there lift for cards at rest; `--shadow-2` is hover; `--shadow-pop` is for menus, dialogs, and a card being moved.
- Motion: 150ms with `--ease` (a soft ease-out) for hover, press, and state changes; 200ms for the drawer and dialogs. Nothing bounces. `prefers-reduced-motion` turns transitions off.

## Components

- **Buttons.** Three tiers, 32px tall (40px on touch screens), 8px radius, 13px medium text:
  - *Primary* — solid `--accent-fill`, white text. At most one per view (while selecting: “Compare on a new board”; in the quick capture: “Save” once there is text).
  - *Quiet* — no background or border; `--text-2`, with `--fill-2` on hover. Section actions such as “New board”, “New note”, “Add image”.
  - *Icon* — 32px square, `--text-3`, with a `title` and accessible name.
  Destructive actions are quiet buttons in `--danger`, confirmed before acting.
- **Inputs.** `--surface` with a `--line-2` edge and 8px radius; on focus the edge becomes `--accent` with a 3px `--accent-soft` ring. Inline-editable text (titles, to-dos) has no edge until focused.
- **Cards.** `--surface`, a `--line-1` edge, 12px radius, `--shadow-1`; on hover the edge becomes `--line-2` with `--shadow-2`.
- **Checkboxes.** Round, 18px, `--line-2` ring when open; `--accent-fill` with a white tick when done. Completed text is `--text-4` and struck through.
- **Segmented control.** A `--fill-2` track; the selected option is a `--surface` pill with `--shadow-1`.
- **Menus and dialogs.** `--surface-raised`, `--shadow-pop`, 10px (menus) or 14px (dialogs) radius. Dialog backdrop is black at 30% (light) or 50% (dark), blurred by 10px so the item in focus stands apart from the page.
- **Icons.** [Iconoir](https://iconoir.com/) regular, 1.5 stroke, `currentColor`, 18px (16px inside small buttons). Sidebar icons are the exported Figma SVGs drawn through a CSS mask so they take `currentColor` in both themes.
- **Loading.** The [loading.dev Ring](https://loading.dev/spinners/ring) at 18px beside “Loading projects…” and 14px beside “Saving…”, inheriting text colour.
- **Save status.** Saving is automatic and stays out of sight. The top strip shows “Saving…” only when a save takes longer than a second, and “Not saved” in `--danger` when one fails; otherwise it shows nothing. Only pending work animates.

## Layout

- **Page column (default for every page).** A page's heading and content share one column, at most 1232px wide (1296px with its 32px gutters), centred in the space beside the sidebar. Opening or closing the sidebar shifts the whole page together, and spare width is split evenly on both sides; below that width the column fills the space with 32px gutters. The scroll area still spans the full width so its scrollbar sits at the window edge. In CSS this is `--page-inline` on `.main-column`, used as the inline padding of the heading and of the page's scroll area; a new page uses it rather than its own width or max-width. The project page follows it, and so does a board's heading; a board's canvas is the one exception and spans the full width with 32px gutters, so there is room to arrange cards however wide the window is.

- **Sidebar.** Full height, 242px by default, resizable 220–400px, hidden completely when closed. Opening a board collapses it so the board has more room; this does not change the saved preference. Reopening it by hand on a board keeps it open until the user leaves that board, and returning to the project page restores the preference. A search control opens the cross-project search dialog, followed by the project list with 36px rows; the current project has a `--fill-2` background and medium weight. The theme switch (System / Light / Dark) sits at the bottom.
- **Top strip.** A 48px row without a divider: the sidebar toggle stays fixed at the top left and its chevron shows the action — pointing left to collapse while the sidebar is open, right to expand while it is closed. Search appears next to it when the sidebar is hidden so it remains available on a board. The save status, when it shows, sits at the far right in 12px `--text-3`. Everything in the strip shares its centre line, 24px from the top.
- **Search.** A centred modal takes a description and shows project, note, and image matches from every project. The field says “Describe a note or figure, then press Enter” and carries a quiet “Search ↵” button. While typing, up to five quick matches by title appear in compact rows with small thumbnails and `--text-2` titles, under a 12px `--text-3` label. Enter shows the full results under a 14px semibold heading “Results for ‘…’” with the count; if search by meaning is unavailable, one 12px `--text-3` line says so. Each result names its project; selecting an item opens it in focus on its project page. Keep the result surface quiet and readable, with an image thumbnail where available. Escape closes search. ⌘K/Ctrl+K opens it from anywhere except a board, where the same shortcut and the strip's search button open board search instead (see Board interaction); the sidebar's search control always opens this one.
- **Project heading.** Editable title (page title style) and description (14px `--text-3`), with its top aligned to the sidebar search field at 56px. No divider below; the heading and content share the page surface.
- **Project page.** Two columns 32px apart: the library fills the main column; a 300px rail on the right holds the to-dos, then the boards, 40px apart, and stays in view while the library scrolls. Below 1000px the rail moves above the library, with to-dos and boards side by side where they fit.
  - To-do: one list per project. Open tasks first and wrapping to fit the rail; completed tasks collect in a “Completed” group, collapsed by default, newest first.
  - Boards: compact rows with a layout preview, name, item count, and last edit, most recently edited first. The first row is raised as a card and says “Continue”. “New board” creates an empty board and opens it.
  - Library: see below.

## Library interaction

- **Quick capture.** A note field sits at the top of the library at all times. Typing and pressing ⌘ Enter (or “Save”) adds a note without opening anything; notes need no title, and their first line stands in for one. An image is added only when the user puts it there: pasting while the cursor is in the field, or dropping onto the field, which highlights while a file is over it. Adding an image releases the cursor, so a later paste cannot add it again by accident. Identical images in one paste or drop are added once. Dropping a file anywhere else on the library does nothing.
- **Grouped by date.** Items are ordered by when they were created, newest first, and never move when edited. Groups are Today, Yesterday, each other day of the past week by weekday, then one group per month. The group heading sticks to the top while its items scroll. Cards in a day group show the time (14:32); cards in a month group show the date (Aug 12). Days without items have no group, and a short group leaves its row part-empty rather than borrowing from the next.
- **Columns.** Cards fill 1–4 columns (at least 220px each), placed left to right and then down, so each row reads in time order. Notes take their natural height up to eight lines; images keep their aspect ratio between 3:4 and 2:1.
- **Selecting.** Hovering a card shows an empty round checkbox at its top-right; clicking it selects the card and enters selection mode, where every card shows its checkbox and a click toggles it. “Select” in the header enters the same mode. The quick capture dims, the header shows the count and “Cancel”, and a floating bar at the bottom of the library offers Delete, “Add to board ▾”, and the primary “Compare on a new board”. Escape leaves selection mode.
- **Context menu.** Right click (long press on touch) opens Open, Select, Add to board ›, and Delete. The board submenu ticks boards that already hold the item and ends with “New board…”. Adding to an existing board stays on the page and shows a brief notice with “Open board”.
- **Focus.** Clicking a card grows it into a 640px dialog in the middle of the screen (images up to 1000px) over the dimmed, blurred page, and shrinks it back on close. It holds the kind and date, a close button, the title, and the text or image; the footer lists the boards the item is on as links and says “Edits save as you type · Esc to close”. There is no save or delete button: edits save shortly after typing stops, and deleting happens from the library.
- Deleting asks once, naming how many boards the items will leave. Deleting a board keeps its items.

## Board interaction

- At rest there is no visible grid. While a card is moved, resized, or dragged in from the library, faint `--line-2` dots mark the grid and an `--accent-soft` preview with a dashed `--accent` edge shows where the card will land.
- Drag a card by its title bar; resize it from its lower-right corner. Cards snap to the grid and cannot overlap; an invalid position keeps the last valid preview.
- Alignment works like PowerPoint's smart guides: when a card's edge lines up with another card's, a 1px `--accent` guide appears; when a resize matches a neighbour's width or height, a small accent label says so. Dragging further simply leaves the match. There are no modifier keys to learn.
- **Board toolbar.** A board has no page heading. Its name sits in the top strip after the sidebar toggle and search: “‹ Project” (14px `--text-3`, back to the project page), a `--text-4` slash, the board name (15px semibold, edited in place), the item count (13px `--text-3`), and the board menu “···” with “Delete board”. The canvas starts right below the strip.
- **Library panel.** A full-height 320px panel on the right, like an inspector: it mirrors the sidebar (`--bg-sidebar`, a `--line-1` edge, a 48px header row titled “Library” in 15px semibold, the search field at 56px) and makes room by narrowing the board rather than covering it. Below 700px it lies over the board instead. Its toggle mirrors the sidebar toggle: one icon fixed at the top right, in the same place whether the panel is open or closed, so opening and closing never moves the pointer's target. The panel slides in over 180ms while the board narrows in step. An empty board opens with the panel open and says “Nothing on this board yet — Drag notes and images here from the library, or press + beside one.” Drag an item onto the board or press “+” to use the next free space. Images open at their aspect ratio; when a card is resized away from it, the image stays whole and the spare space is the card's own surface, not a separate band. Notes can be written directly on the board.
- **Board search.** On a board, ⌘K or the strip's search button opens a 640px search over the dimmed, blurred board that looks only in this project's library, labelled with the project's name. Items not yet on the board come first. ↑↓ move, Enter or a click adds the item at the free space nearest the middle of what is on screen, and the new card is outlined in `--accent` for a moment. Choosing an item already on the board (marked “✓ On board”) scrolls to it and outlines it instead of adding a copy. Escape closes it.
- Card title bars are 36px with no divider. The move and resize handles are buttons: arrow keys move a card or change its size by one grid step.

## Accessibility

- Every control has a visible focus state (`--accent` ring) and an accessible name; icon-only buttons also have a `title`.
- Keep native elements where they fit: buttons, checkboxes (restyled), dialogs, and text inputs.
- Check both themes for contrast when adding colours, and check touch layouts at 820px.

## References

Notion documents sidebar collapse and edge resizing; Apple's Human Interface Guidelines emphasise legible text, a clear hierarchy, few typefaces, sufficient contrast, and dark mode as a first-class appearance. Things 3 and Linear are the reference for calm density and quiet controls. This project uses those principles while keeping its own UI and data model.
