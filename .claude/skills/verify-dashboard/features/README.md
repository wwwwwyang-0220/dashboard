# Dashboard feature map

What the dashboard does, written from the user's side. Agents use it to decide what to drive and what counts as proof. The owner uses it as the checklist of behavior that must keep working.

Each file has the same four sections: sub-features, how a user gets there, how to drive it with `control-dashboard.mjs`, and gotchas.

## Baseline

- `up` and a passing `doctor` before driving. Fixtures: **Reading Study** (`verify-alpha`) has to-dos, three library items, and the board "Method vs results"; **反应时实验** (`verify-beta`) is empty, for empty states.
- Start from `open "/?project=verify-alpha"` unless the feature file says otherwise.
- Persistence means: `reload` shows it, and `data` has it.

## Features

- [project-page](project-page.md): project list in the sidebar, project title and description, sidebar and appearance.
- [todos](todos.md): add, complete, reopen, edit, delete tasks; completed fold.
- [library](library.md): quick-capture notes, images, date groups, filters, focus editing, select, delete.
- [boards](boards.md): make a board from a selection, open, rename, arrange cards, add from the drawer, delete.
- [search](search.md): ⌘K search across projects, quick matches, full results, opening a result.

## Full sweep

For a broad "did anything break?" check, walk the files top to bottom at `desktop`, then repeat the project page and a board at `narrow` and with `webkit-shot`.
