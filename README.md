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

To reach the dev server through another hostname, such as a Tailscale name, list it in a git-ignored `.env.local`:

```sh
echo 'DASHBOARD_ALLOWED_HOSTS=my-mac.example.ts.net' > .env.local
```

Separate several hosts with commas. Without it, Vite accepts only localhost.

`data/projects.json` contains personal dashboard content and is excluded from Git. Copy the example only on a fresh checkout; do not overwrite an existing data file. Changes saved through the dashboard persist across refreshes and clients using this Mac's API.

The sidebar can be hidden or resized, and its footer switches between system, light, and dark appearance; those device preferences are stored in the browser. Search opens from the sidebar, the top strip, or ⌘K/Ctrl+K. Typing shows quick matches by title; Enter searches everything — project titles, note titles and bodies, image titles, text recognized in images, and what images show — across projects using the local API. OCR runs on the Mac after an image item is saved, and each image is also embedded once with Google's `gemini-embedding-2` so it can be found by description. Search by meaning needs a Gemini API key and a network connection; without them search falls back to keywords and image text.

Each project page centres on a library of notes and images, grouped by date, with a quick-capture field on top; a rail beside it holds the to-do list and saved boards. Selecting library items (hover a card's checkbox, or right-click it) puts them on a board, which lays them side by side on a 24-column grid for comparison and keeps that arrangement. Uploaded images are stored in `data/files/`, which is also excluded from Git.

## Where to continue

- `src/App.jsx` owns project and board selection (`?project=` and `?board=` URL parameters), the sidebar, the project heading, and the save queue. `changeProject` applies local changes and saves the named fields.
- `src/ProjectHome.jsx` lays out the project page and creates or fills boards from library selections. `src/Library.jsx` holds the library: quick capture, date groups, selection, and the card context menu; `src/ItemFocus.jsx` is the dialog that edits one item in focus. `groupByDate` in `src/items.js` decides the groups. `src/TodoList.jsx` holds the to-do list.
- `src/BoardView.jsx` owns a board: card arrangement, alignment guides, and the library drawer. `src/board-layout.js` holds the grid rules (collision, free-slot search, alignment) as plain functions.
- `server/index.js` exposes the local API. `server/project-store.js` validates writes and saves atomically to `data/projects.json`. `GET /api/projects` loads projects; `PUT /api/projects/:id` saves the title and description; `PUT /api/projects/:id/todos`, `/items`, and `/boards` replace those lists; `POST /api/projects/:id/images` stores an uploaded image and `GET /api/files/:name` serves it. Removing an image item deletes its file.
- `GET /api/search?q=` reads saved projects and returns ranked project, note, and image matches; `server/search.js` holds the in-memory MiniSearch (BM25) index, its matching rules, and excerpts; the index rebuilds from saved data on start and follows each save. `server/ocr-index.js` indexes image text asynchronously through the local Vision helper in `server/vision-ocr.swift`, and `server/embedding-index.js` embeds images and queries and ranks images by similarity. Their rebuildable results and the compiled helper live under ignored `data/search/`, outside project API payloads. `GET /api/search/index` returns OCR and embedding counts; `POST /api/search/rebuild` redoes both for all saved images. The Gemini key is read from `GEMINI_API_KEY`, `~/.config/gemini/key`, or the macOS Keychain item `GEMINI_API_KEY`, in that order. Project titles, note text, and image titles remain searchable while OCR is pending or failed.
- Projects saved before the library existed load without a manual migration: checklist items become to-dos and text or reference blocks become notes. The old `blocks` and `layouts` fields stay in the JSON file untouched.
- `DESIGN.md` records the visual direction, the design tokens, and links the Figma wireframes. The tokens live in `src/index.css` with light and dark values; components use them instead of raw colours.

Current scope: desktop first, with layouts that stack below 1000px; iPad touch arrangement uses the same pointer handling but has not been tested on a device. There is no in-app control to create or delete a project; the example JSON shows the starting data shape. Use disposable `PROJECTS_DATA_FILE`, `PROJECTS_FILES_DIR`, `SEARCH_INDEX_FILE`, and `EMBEDDING_INDEX_FILE` paths for write checks so personal project content is not changed during testing. `API_PORT` and `API_PROXY_TARGET` can point the API and Vite proxy at a disposable test instance.

## Search decisions

These choices were tested on real dashboard figures; keep them unless new evidence says otherwise.

- The search box is for describing content; the project library covers picking a known item. Typing shows quick title and project matches; Enter runs the full search, whose list sits under “Results for ‘…’”.
- Full search fuses MiniSearch BM25 (titles, project names, note text, OCR) with up to ten images closest to the query embedding by Reciprocal Rank Fusion. Images join only above a cosine similarity of 0.60: on the test figures intended images scored 0.66–0.71 and unrelated, gibberish, or absent-figure queries at most 0.59. That floor comes from four figures; recalibrate it if relevant images go missing as the library grows. Ties go to the keyword rank: it reflects exact labels and project names, while `gemini-embedding-2` sees a downscaled image (258 tokens). Project names in the query are the main way to separate look-alike figures from different projects.
- Image embedding is always on and sends only the image, on Gemini's paid tier. 768 dimensions ranked the test figures the same as 3072. Before embedding, `sips` shrinks images to 1536 px on the long side and converts GIF and WebP to PNG, so every upload up to the 25 MB limit can be embedded; shrunk vectors stayed within 0.99 cosine of full size.
- Queries are expected in English; offline search does not translate Chinese queries to English figure labels.
- No reranker. Fusion alone put the intended figure first in every test query. Add one only if real searches miss in ways fusion cannot fix, and then compare a hosted model (TypeSafe Jev) with a local one (for example Laya) on dashboard figures, sending only text.
- Move keyword search to SQLite FTS5 if building the in-memory index at API start becomes noticeably slow or memory grows clearly; FTS5 lacks MiniSearch's fuzzy matching for OCR misreads.
- The Keychain is locked to an API started in a detached tmux session or cron; use `GEMINI_API_KEY` or `~/.config/gemini/key` there.

## Checks

```sh
npm run lint
npm run build
node --test test/search.test.js
```
