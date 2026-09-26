# Dashboard

A personal project workspace built with React, Vite, and a local Express API. Each project has its own page with a to-do list, a library of notes and images, and boards for comparing them side by side. Project content is saved on the Mac in `data/projects.json`.

## Run locally

Requires Node.js 20.19+ or 22.12+ on macOS. Image OCR also requires the macOS Vision framework and the Swift compiler (`swiftc`); the OCR helper compiles automatically on first use.

```sh
npm ci
cp data/projects.example.json data/projects.json
npm run dev
```

Open the URL printed by Vite. The API and frontend run together with `npm run dev`.

`data/projects.json` contains personal dashboard content and is excluded from Git. Copy the example only on a fresh checkout; do not overwrite an existing data file. Changes saved through the dashboard persist across refreshes and clients using this Mac's API.

The sidebar can be hidden or resized, and its footer switches between system, light, and dark appearance; those device preferences are stored in the browser. Search opens from the sidebar, the top strip, or ⌘K/Ctrl+K. It finds project titles, note titles and bodies, image titles, and text recognized in images across projects using the local API. OCR runs on the Mac after an image item is saved; search shows indexing progress and refreshes results when it finishes. Image meaning and chart relationships remain planned in `todo/search.md`.

Each project page centres on a library of notes and images, grouped by date, with a quick-capture field on top; a rail beside it holds the to-do list and saved boards. Selecting library items (hover a card's checkbox, or right-click it) puts them on a board, which lays them side by side on a 24-column grid for comparison and keeps that arrangement. Uploaded images are stored in `data/files/`, which is also excluded from Git.

## Where to continue

- `src/App.jsx` owns project and board selection (`?project=` and `?board=` URL parameters), the sidebar, the project heading, and the save queue. `changeProject` applies local changes and saves the named fields.
- `src/ProjectHome.jsx` lays out the project page and creates or fills boards from library selections. `src/Library.jsx` holds the library: quick capture, date groups, selection, and the card context menu; `src/ItemFocus.jsx` is the dialog that edits one item in focus. `groupByDate` in `src/items.js` decides the groups. `src/TodoList.jsx` holds the to-do list.
- `src/BoardView.jsx` owns a board: card arrangement, alignment guides, and the library drawer. `src/board-layout.js` holds the grid rules (collision, free-slot search, alignment) as plain functions.
- `server/index.js` exposes the local API. `server/project-store.js` validates writes and saves atomically to `data/projects.json`. `GET /api/projects` loads projects; `PUT /api/projects/:id` saves the title and description; `PUT /api/projects/:id/todos`, `/items`, and `/boards` replace those lists; `POST /api/projects/:id/images` stores an uploaded image and `GET /api/files/:name` serves it. Removing an image item deletes its file.
- `GET /api/search?q=` reads saved projects and returns ranked project, note, and image matches; `server/search.js` holds the in-memory MiniSearch (BM25) index, its matching rules, and excerpts; the index rebuilds from saved data on start and follows each save. `server/ocr-index.js` indexes image text asynchronously through the local Vision helper in `server/vision-ocr.swift`. Its rebuildable results and compiled helper live under ignored `data/search/`, outside project API payloads. `GET /api/search/index` returns pending, ready, and failed image counts; `POST /api/search/rebuild` retries and rebuilds OCR for all saved images. Project titles, note text, and image titles remain searchable while OCR is pending or failed.
- Projects saved before the library existed load without a manual migration: checklist items become to-dos and text or reference blocks become notes. The old `blocks` and `layouts` fields stay in the JSON file untouched.
- `DESIGN.md` records the visual direction, the design tokens, and links the Figma wireframes. The tokens live in `src/index.css` with light and dark values; components use them instead of raw colours.

Current scope: desktop first, with layouts that stack below 1000px; iPad touch arrangement uses the same pointer handling but has not been tested on a device. There is no in-app control to create or delete a project; the example JSON shows the starting data shape. Use disposable `PROJECTS_DATA_FILE`, `PROJECTS_FILES_DIR`, and `SEARCH_INDEX_FILE` paths for write checks so personal project content is not changed during testing. `API_PORT` and `API_PROXY_TARGET` can point the API and Vite proxy at a disposable test instance.

## Checks

```sh
npm run lint
npm run build
node --test test/search.test.js
```
