# Project workspace visual direction

The desktop project page concept is [project-page-desktop.png](design/concepts/project-page-desktop.png). Use it as the visual reference for this implementation, with the legacy project status shown in that image omitted. The interface is a quiet reading workspace: compact navigation, clear typography, a stable project heading, and an open two-dimensional canvas with grid-snapped modules. iPad adaptation is deferred.

The sidebar follows the [fixed-toggle Figma study](https://www.figma.com/design/MMaBQyriJEDU5naDco5Efe/Dashboard_V1?node-id=15-2). Project navigation occupies a full-height left column when open and leaves the canvas unobstructed. The project page and grid-snapped canvas retain their own visual treatment.

## Design frames

Use a 1440 × 1024 CSS-pixel frame for desktop exploration in [Dashboard_V1](https://www.figma.com/design/MMaBQyriJEDU5naDco5Efe/Dashboard_V1?node-id=0-1). Keep the current UI reference beside a separate editable exploration copy. This frame is a design baseline, not a fixed application size; check narrower viewports and create separate frames when designing responsive behavior.

## Structure

- The left sidebar starts with project search, followed by the project list. The selected project is indicated in the list; its title and description appear in the project heading.
- The sidebar occupies a full-height left column when open and collapses completely when closed. Its default width is 242px and its edge remains resizable.
- Reserve a 56px top utility row without a divider. Its transparent 44px sidebar toggle stays at the same screen position in both states; save status sits at the far right.
- The project heading is separate from the canvas. It contains the editable project name and description and stays visible while panning.
- Align the top of the project title with the top of the sidebar search field at 63px from the viewport top.
- The canvas pans in both axes. Modules snap to a 24px coordinate grid; every fifth unit is indicated by a faint cross. The grid supports arrangement without dominating reading.
- Add block and zoom/origin controls stay anchored to the canvas viewport. Modules retain their coordinates when the sidebar width changes.

## Typography and color

Use the macOS system sans-serif stack so no font download is required. Product values are derived from the accepted concept; they are not claimed as Notion's proprietary design tokens.

| Role | Size and weight | Color |
| --- | --- | --- |
| Project title | 24px, bold | `#252a31` |
| Module heading | 26px, semibold | `#20242b` |
| Reading text | 17px, regular, 1.6 line height | `#444c58` |
| Sidebar and controls | 14–16px, regular or medium | `#343840` |
| Secondary text | 14–16px | `#626a76` |
| Main canvas | — | `#ffffff` |
| Sidebar | — | `#fbfaf8` |
| Hairline border | — | `#e5e7eb` |

Use color to support meaning, not decoration. Keep canvas modules white with subtle borders, small radii, and almost no shadow. The sidebar uses a quiet surface, compact project rows, and a subtle selected state. Avoid glass, glows, and heavy visible grids.

## Icons

Use the exported icons from the sidebar Figma concept within project navigation. Elsewhere, use the regular [Iconoir](https://iconoir.com/) React icons for navigation and actions. Keep Iconoir's 24px viewBox, 1.5 stroke weight, and `currentColor`; display them at 18px by default. Use one icon per action, with the action's accessible name on its button. Keep icons decorative when adjacent text already names the action. Preserve native checkboxes and text feedback rather than replacing them with icons.

## Loading feedback

Use the [loading.dev Ring](https://loading.dev/spinners/ring) for indeterminate work. Show it at 18px beside “Loading projects…” on initial fetch and at 14px beside “Saving…” in the top strip. Keep both at the same restrained speed and inherit the surrounding text color. Pair motion with text so the pending action is clear; the animation itself is decorative. Do not animate saved, unsaved, failed, or empty states. Respect reduced motion.

## Interaction

- The fixed sidebar button opens and closes the navigation without moving. The sidebar's right edge can be dragged or adjusted with arrow keys. Store open state and width as device preferences in browser storage.
- Project content and each project's blocks persist through the local API to `data/projects.json`.
- Blank canvas space pans. Module handles drag and resize in grid increments. Inputs remain editable without starting a pan.
- Search currently filters project titles locally. Broader content search can be designed later.
- Controls need visible keyboard focus. Canvas arrow keys pan when the canvas itself is focused. Respect reduced motion preferences.

## Reference principles

Notion's official help documents sidebar collapse and edge resizing and offers page typography choices. Apple's Human Interface Guidelines emphasize legible text, a clear type hierarchy, few typefaces, and sufficient contrast. This project uses those principles while keeping its own UI and data model.
