# Project workspace design

A calm tool for keeping one project's work in order. It should feel like a well-made native app — Things, Linear, Apple Notes — rather than a web form or a presentation: soft surfaces instead of outlines, one accent colour, a short type scale, generous and regular spacing, and quiet motion.

## Product structure

Each project is an organised cabinet, not an open canvas. Its page holds one to-do list, a library of notes and images, and a set of saved boards. A board is where the user lays chosen library items side by side to compare them; it is opened when needed and remembers its arrangement.

The accepted wireframes are in [Dashboard_V2](https://www.figma.com/design/47imLoFGQTJMkL3Mgy4tKU): 01 project page, 02 board at rest, 03 board with the library drawer while dragging, 04 resize snapping to a neighbour's size. They fix structure and behaviour; the visual values below supersede their colours and type sizes. Dashboard_V1 keeps the sidebar study and the retired free-canvas concept.

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
| `--surface-raised` | `#ffffff` | `#26282c` | Menus, drawer, dialogs |
| `--surface-well` | `#f1f0ec` | `#191a1d` | Image backgrounds, previews |
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
- `--shadow-1` is a barely-there lift for cards at rest; `--shadow-2` is hover; `--shadow-pop` is for menus, the drawer, dialogs, and a card being moved.
- Motion: 150ms with `--ease` (a soft ease-out) for hover, press, and state changes; 200ms for the drawer and dialogs. Nothing bounces. `prefers-reduced-motion` turns transitions off.

## Components

- **Buttons.** Three tiers, 32px tall (40px on touch screens), 8px radius, 13px medium text:
  - *Primary* — solid `--accent-fill`, white text. At most one per view (on a board: “Add from library”; in a dialog: “Done”).
  - *Quiet* — no background or border; `--text-2`, with `--fill-2` on hover. Section actions such as “New board”, “New note”, “Add image”.
  - *Icon* — 32px square, `--text-3`, with a `title` and accessible name.
  Destructive actions are quiet buttons in `--danger`, confirmed before acting.
- **Inputs.** `--surface` with a `--line-2` edge and 8px radius; on focus the edge becomes `--accent` with a 3px `--accent-soft` ring. Inline-editable text (titles, to-dos) has no edge until focused.
- **Cards.** `--surface`, a `--line-1` edge, 12px radius, `--shadow-1`; on hover the edge becomes `--line-2` with `--shadow-2`.
- **Checkboxes.** Round, 18px, `--line-2` ring when open; `--accent-fill` with a white tick when done. Completed text is `--text-4` and struck through.
- **Segmented control.** A `--fill-2` track; the selected option is a `--surface` pill with `--shadow-1`.
- **Menus and dialogs.** `--surface-raised`, `--shadow-pop`, 10px (menus) or 14px (dialogs) radius. Dialog backdrop is black at 30% (light) or 50% (dark).
- **Icons.** [Iconoir](https://iconoir.com/) regular, 1.5 stroke, `currentColor`, 18px (16px inside small buttons). Sidebar icons are the exported Figma SVGs drawn through a CSS mask so they take `currentColor` in both themes.
- **Loading.** The [loading.dev Ring](https://loading.dev/spinners/ring) at 18px beside “Loading projects…” and 14px beside “Saving…”, inheriting text colour. Only pending work animates.

## Layout

- **Sidebar.** Full height, 242px by default, resizable 220–400px, hidden completely when closed. Opening a board collapses it so the board gets the full width; this does not change the saved preference. Reopening it by hand on a board keeps it open until the user leaves that board, and returning to the project page restores the preference. Search field, then the project list with 36px rows; the current project has a `--fill-2` background and medium weight. The theme switch (System / Light / Dark) sits at the bottom.
- **Top strip.** A 48px row without a divider: the sidebar toggle stays fixed at the top left and its chevron shows the action — pointing left to collapse while the sidebar is open, right to expand while it is closed; the save status sits at the far right in 12px `--text-3`.
- **Project heading.** Editable title (page title style) and description (14px `--text-3`), with its top aligned to the sidebar search field at 56px. No divider below; the heading and content share the page surface.
- **Project page.** Content is left-aligned with a 32px gutter and a 1200px maximum width. Two columns: to-dos (340px) on the left; boards, then the library, on the right, 48px apart. Below 1000px they stack in that order.
  - To-do: one list per project. Open tasks first; completed tasks collect in a collapsible “Completed” group, newest first.
  - Boards: cards with a layout preview, name, item count, and last edit. “New board” creates one and opens it.
  - Library: notes and images in one grid, newest first, filterable by type. A card opens the item in a dialog for editing, viewing, or deletion. Deleting an item also removes it from every board; deleting a board keeps its items.
- **Board.** The heading becomes a breadcrumb back to the project, the editable board name, the item count, the primary “Add from library” button, and a menu with “Delete board”. The board scrolls vertically only; cards sit on 24 proportional columns and 24px rows with 16px gutters, so it fills the available width and keeps its proportions when the sidebar or window changes.

## Board interaction

- At rest there is no visible grid. While a card is moved, resized, or dragged in from the library, faint `--line-2` dots mark the grid and an `--accent-soft` preview with a dashed `--accent` edge shows where the card will land.
- Drag a card by its title bar; resize it from its lower-right corner. Cards snap to the grid and cannot overlap; an invalid position keeps the last valid preview.
- Alignment works like PowerPoint's smart guides: when a card's edge lines up with another card's, a 1px `--accent` guide appears; when a resize matches a neighbour's width or height, a small accent label says so. Dragging further simply leaves the match. There are no modifier keys to learn.
- The library drawer slides in from the right over the board. Drag an item onto the board or press “+” to use the next free space. Images open at their aspect ratio; notes can be written directly on the board.
- Card title bars are 36px with no divider. The move and resize handles are buttons: arrow keys move a card or change its size by one grid step.

## Accessibility

- Every control has a visible focus state (`--accent` ring) and an accessible name; icon-only buttons also have a `title`.
- Keep native elements where they fit: buttons, checkboxes (restyled), dialogs, and text inputs.
- Check both themes for contrast when adding colours, and check touch layouts at 820px.

## References

Notion documents sidebar collapse and edge resizing; Apple's Human Interface Guidelines emphasise legible text, a clear hierarchy, few typefaces, sufficient contrast, and dark mode as a first-class appearance. Things 3 and Linear are the reference for calm density and quiet controls. This project uses those principles while keeping its own UI and data model.
