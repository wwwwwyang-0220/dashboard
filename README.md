# Dashboard

A personal project workspace built with React, Vite, and a local Express API. Each project opens its own page with a grid-snapped, two-dimensional canvas. Project content and blocks are saved on the Mac in `data/projects.json`.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
cp data/projects.example.json data/projects.json
npm run dev
```

Open the URL printed by Vite. The API and frontend run together with `npm run dev`.

`data/projects.json` contains personal dashboard content and is excluded from Git. Copy the example only on a fresh checkout; do not overwrite an existing data file. Changes saved through the dashboard persist across refreshes and clients using this Mac's API.

The sidebar can be hidden or resized. Those device preferences are stored in the browser. The sidebar search currently filters project titles. On the canvas, drag blank space to pan, use a block's move and resize handles to arrange it on the grid, and use **Add block** to create a text note, checklist, or references block. Existing projects load without a data migration; their previous dashboard layout fields are preserved in the JSON file.

## Where to continue

- `src/App.jsx` owns project selection, the sidebar, the fixed page heading, and the save queue. The selected project is reflected in the `?project=` URL parameter.
- `src/Canvas.jsx` owns the canvas viewport, pan and zoom, and grid-snapped text, checklist, and references blocks. Block coordinates and sizes use 24px grid units; viewport position and zoom reset when switching projects.
- `server/index.js` exposes the local API. `server/project-store.js` validates writes and saves atomically to `data/projects.json`. `GET /api/projects` loads projects; `PUT /api/projects/:id` saves the title and description; `PUT /api/projects/:id/blocks` saves that project's blocks. Older card-layout fields are retained for compatibility but are not used by the new canvas.
- `DESIGN.md` records the visual direction, and `design/concepts/project-page-desktop.png` is the accepted desktop concept. The image still shows a legacy project status; the implemented page intentionally omits that field.

Current scope: desktop layout first; iPad adaptation is deferred. Sidebar search filters titles only. There is no in-app control to create or delete a project; the example JSON shows the starting data shape. Project status (`active`, `paused`, etc.) is retired. Local preferences belong in browser storage; project content belongs in the API-backed JSON file. Use a disposable `PROJECTS_DATA_FILE` for write checks so personal project content is not changed during testing. `API_PORT` and `API_PROXY_TARGET` can point the API and Vite proxy at a disposable test instance.

## Checks

```sh
npm run lint
npm run build
```
