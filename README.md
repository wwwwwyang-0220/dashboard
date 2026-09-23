# Dashboard

A personal project dashboard built with React, Vite, and a local Express API. Project content and layouts are saved on the Mac in `data/projects.json`.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
cp data/projects.example.json data/projects.json
npm run dev
```

Open the URL printed by Vite. The API and frontend run together with `npm run dev`.

`data/projects.json` contains personal dashboard content and is excluded from Git. Copy the example only on a fresh checkout; do not overwrite an existing data file. Changes saved through the dashboard persist across refreshes and clients using this Mac's API.

## Checks

```sh
npm run lint
npm run build
```
