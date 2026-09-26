# Project page

Each project has its own page. The sidebar lists projects; the page header holds the project's title and description, which save when you leave the field.

## Sub-features

- `switch-project`: choosing a project in the sidebar opens its page and puts `?project=` in the address.
- `edit-title`, `edit-description`: edit in place; saves on leaving the field or pressing Enter in the title.
- `empty-field`: clearing the title or description is refused and shows "Not saved".
- `sidebar`: collapse and expand; drag or arrow-key resize (220–400 px). Remembered on this device only.
- `appearance`: System, Light, Dark in the sidebar footer. Remembered on this device only.

## How to get to it (user POV)

- Click a project name under **Projects** in the sidebar.
- Click the project title or the line under it and type.
- The button at the top left collapses or expands the sidebar.
- The three icons at the bottom of the sidebar switch the appearance.

## Driving it with control-dashboard

- Switch: `click --role button --name "反应时实验" --within 'nav'`. Expect `url` with `project=verify-beta` and the empty library message.
- Rename: `fill --label "Project title" --value "Reading Study v2"`, then `press Enter --label "Project title"`. Proof: sidebar shows the new name after `reload`; `data --project verify-alpha` has the new title.
- Empty title: `fill --label "Project title" --value ""`, `press Tab`. Expect `saveState: "failed"` and the old title unchanged in `data`.
- Sidebar: `click --role button --name "Collapse sidebar"`; after `reload` it stays collapsed. Theme: `click --role radio --name Dark`, then `eval "document.documentElement.dataset.theme"` → `dark`.

## Gotchas

- Sidebar and theme live in the browser's localStorage, so they persist across `reload` but never appear in `data`.
- There is no in-app way to create or delete a project. That is a scope limit, not a bug.
- `--label "Title"` without `--exact` also matches "Project title".
