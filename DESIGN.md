# Project workspace visual direction

Each project is an organised cabinet, not an open canvas. Its page holds one to-do list, a library of notes and images, and a set of saved boards. A board is where the user lays chosen library items side by side to compare them; it is opened when needed and remembers its arrangement. The interface stays a quiet reading workspace: compact navigation, clear typography, and a stable project heading.

The accepted wireframes are in [Dashboard_V2](https://www.figma.com/design/47imLoFGQTJMkL3Mgy4tKU): 01 project page, 02 board at rest, 03 board with the library drawer while dragging, 04 resize snapping to a neighbour's size. The sidebar follows the [fixed-toggle study](https://www.figma.com/design/MMaBQyriJEDU5naDco5Efe/Dashboard_V1?node-id=15-2) in Dashboard_V1, which also keeps the retired free-canvas concept for reference.

## Design frames

Use a 1440 × 1024 CSS-pixel frame for desktop exploration. This frame is a design baseline, not a fixed application size; check narrower viewports and create separate frames when designing responsive behavior.

## Structure

- The left sidebar starts with project search, followed by the project list. The selected project is indicated in the list; its title and description appear in the project heading.
- The sidebar occupies a full-height left column when open and collapses completely when closed. Its default width is 242px and its edge remains resizable.
- Reserve a 56px top utility row without a divider. Its transparent 44px sidebar toggle stays at the same screen position in both states; save status sits at the far right.
- The project heading contains the editable project name and description. Align the top of the title with the top of the sidebar search field at 63px from the viewport top.
- Below the heading, the project page has two columns: the to-do list (360px) on the left; boards, then the library, on the right. Below 1000px they stack in that order.
- To-do: one list per project. Open tasks first; completed tasks are struck through and collect in a collapsible “Completed” group, newest first.
- Boards: cards with a small layout preview, name, item count, and last edit. “New board” creates one and opens it.
- Library: notes and images in one grid, newest first, filterable by type. A card opens the item in a dialog for editing, viewing, or deletion. Deleting an item also removes it from every board; deleting a board keeps its items.
- A board replaces the project heading with a breadcrumb back to the project, the editable board name, and its actions: “Add from library” and a menu with “Delete board”.
- Boards scroll vertically only. Cards sit on 24 proportional columns and 24px rows with 16px gutters, so a board fills the available width and keeps its proportions when the sidebar or window changes.

## Typography and color

Use the macOS system sans-serif stack so no font download is required. Product values are derived from the accepted concept; they are not claimed as Notion's proprietary design tokens.

| Role | Size and weight | Color |
| --- | --- | --- |
| Project title | 24px, bold | `#252a31` |
| Section heading | 18px, semibold | `#20242b` |
| Card title | 14px, medium | `#252a31` |
| Reading text | 17px, regular, 1.6 line height | `#444c58` |
| Sidebar and controls | 14–16px, regular or medium | `#343840` |
| Secondary text | 14–16px | `#626a76` |
| Main surface | — | `#ffffff` |
| Sidebar | — | `#fbfaf8` |
| Hairline border | — | `#e5e7eb` |

Use color to support meaning, not decoration. Keep cards white with subtle borders, 6px radii, and almost no shadow. Arrangement feedback uses a blue dashed landing preview (`#4b79bd`) and pink alignment guides and labels (`#e0457b`); both appear only while arranging. The sidebar uses a quiet surface, compact project rows, and a subtle selected state. Avoid glass, glows, and heavy visible grids.

## Icons

Use the exported icons from the sidebar Figma concept within project navigation. Elsewhere, use the regular [Iconoir](https://iconoir.com/) React icons for navigation and actions. Keep Iconoir's 24px viewBox, 1.5 stroke weight, and `currentColor`; display them at 18px by default. Use one icon per action, with the action's accessible name on its button. Keep icons decorative when adjacent text already names the action. Preserve native checkboxes and text feedback rather than replacing them with icons.

## Loading feedback

Use the [loading.dev Ring](https://loading.dev/spinners/ring) for indeterminate work. Show it at 18px beside “Loading projects…” on initial fetch and at 14px beside “Saving…” in the top strip. Keep both at the same restrained speed and inherit the surrounding text color. Pair motion with text so the pending action is clear; the animation itself is decorative. Do not animate saved, unsaved, failed, or empty states. Respect reduced motion.

## Interaction

- The fixed sidebar button opens and closes the navigation without moving. The sidebar's right edge can be dragged or adjusted with arrow keys. Store open state and width as device preferences in browser storage.
- Project content, to-dos, library items, and boards persist through the local API to `data/projects.json`; image files are stored in `data/files/`.
- A board has no visible grid at rest. While a card is moved, resized, or dragged in from the library, faint dots mark the grid and a dashed preview shows where the card will land.
- Drag a card by its title bar and resize it from its lower-right corner. Cards snap to the grid and cannot overlap; an invalid position keeps the last valid preview.
- Alignment works like PowerPoint's smart guides: when a card's edge lines up with another card's, a pink guide appears; when a resize matches a neighbour's width or height, a label says so. Dragging further simply leaves the match. There are no modifier keys to learn.
- Add library items from the drawer by dragging them onto the board or pressing “+”, which uses the next free space. Images open at their aspect ratio. Notes can be written directly on the board.
- The move and resize handles are buttons: arrow keys move a card or change its size by one grid step.
- Search currently filters project titles locally. Broader content search can be designed later.
- Controls need visible keyboard focus. Respect reduced motion preferences. On touch screens, card controls are always visible.

## Reference principles

Notion's official help documents sidebar collapse and edge resizing and offers page typography choices. Apple's Human Interface Guidelines emphasize legible text, a clear type hierarchy, few typefaces, and sufficient contrast. This project uses those principles while keeping its own UI and data model.
