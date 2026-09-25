# Dashboard

A personal project workspace built with React, Vite, and a local Express API. Each project has its own page with a to-do list, a library of notes and images, and boards for comparing them side by side. Project content is saved on the Mac in `data/projects.json`.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
cp data/projects.example.json data/projects.json
npm run dev
```

Open the URL printed by Vite. The API and frontend run together with `npm run dev`.

`data/projects.json` contains personal dashboard content and is excluded from Git. Copy the example only on a fresh checkout; do not overwrite an existing data file. Changes saved through the dashboard persist across refreshes and clients using this Mac's API.

The sidebar can be hidden or resized; those device preferences are stored in the browser. The sidebar search filters project titles.

Each project page has a to-do list, a library of notes and images, and saved boards. A board lays chosen library items side by side on a 24-column grid for comparison and keeps that arrangement. Uploaded images are stored in `data/files/`, which is also excluded from Git.

## Where to continue

- `src/App.jsx` owns project and board selection (`?project=` and `?board=` URL parameters), the sidebar, the project heading, and the save queue. `changeProject` applies local changes and saves the named fields.
- `src/ProjectHome.jsx` lays out the project page; `src/TodoList.jsx` and `src/Library.jsx` hold the to-do list and the library with its item dialog.
- `src/BoardView.jsx` owns a board: card arrangement, alignment guides, and the library drawer. `src/board-layout.js` holds the grid rules (collision, free-slot search, alignment) as plain functions.
- `server/index.js` exposes the local API. `server/project-store.js` validates writes and saves atomically to `data/projects.json`. `GET /api/projects` loads projects; `PUT /api/projects/:id` saves the title and description; `PUT /api/projects/:id/todos`, `/items`, and `/boards` replace those lists; `POST /api/projects/:id/images` stores an uploaded image and `GET /api/files/:name` serves it. Removing an image item deletes its file.
- Projects saved before the library existed load without a manual migration: checklist items become to-dos and text or reference blocks become notes. The old `blocks` and `layouts` fields stay in the JSON file untouched.
- `DESIGN.md` records the visual direction and links the Figma wireframes.

Current scope: desktop first, with layouts that stack below 1000px; iPad touch arrangement uses the same pointer handling but has not been tested on a device. There is no in-app control to create or delete a project; the example JSON shows the starting data shape. Use a disposable `PROJECTS_DATA_FILE` (and `PROJECTS_FILES_DIR`) for write checks so personal project content is not changed during testing. `API_PORT` and `API_PROXY_TARGET` can point the API and Vite proxy at a disposable test instance.

## Checks

```sh
npm run lint
npm run build
```
