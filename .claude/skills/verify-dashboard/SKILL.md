---
name: verify-dashboard
description: "Prove a dashboard change works by driving a disposable copy of the app in headless Chromium (and WebKit for an iPad-sized check): launch, click and type through the real UI, read back saved data, and capture screenshots. Use after a change to what the user can do or what gets saved, for a milestone sweep, for /verify-dashboard, or when asked to show that a dashboard feature works."
---

# Verify the dashboard

The owner of this app reviews behavior, not code. A change is done when a claim about what the user sees has been driven through the real UI, the saved data agrees, and the evidence is handed over with an honest verdict.

All commands run from the repo root through one CLI. `--help` is canonical.

```bash
C=".claude/skills/verify-dashboard/control-dashboard.mjs"
node $C --help
```

Node comes from fnm. If `node` is missing, `export PATH=~/.local/share/fnm/node-versions/v24.21.0/installation/bin:$PATH`.

The browsers are Playwright's Chromium and WebKit builds pinned to `playwright-core` in `package.json`, stored in `~/Library/Caches/ms-playwright` (or `PLAYWRIGHT_BROWSERS_PATH`). When `up` or `webkit-shot` reports one missing, for example after the cache was cleared or `playwright-core` was upgraded, run `npm run verify:browsers` (under a minute; about 700 MB on disk) and retry.

## 0. Match the effort to the change

The project is early and features change fast, so pick the tier before starting and do only what it asks.

| Tier | Change | Verification |
|---|---|---|
| 1 | Copy, spacing, colour, a local fix that does not change what the user can do or what gets saved | `npm run lint` and `npm run build`; one screenshot if visual. Skip the rest of this skill. When unsure, or when the change touches `server/` or saving, use tier 2. |
| 2 | A feature or behavior change | Automatic, as part of the task: steps 1–6 for the changed behavior only. A storage-format change also needs the real-data check below. |
| 3 | Milestone sweep, run only when the owner asks | Walk `features/README.md` top to bottom and update the feature files. |

### Storage-format changes

Fixtures are hand-written and cannot show whether old records survive a new format. For any change to how `server/project-store.js` reads or writes data:

1. Before editing, copy `data/projects.json` to `data/projects.backup-<date>.json` (git-ignored). The owner's `npm run dev` restarts the API on every server edit, so in-progress code runs against real data.
2. After the change, `up --from-real-data`. It copies `data/projects.json` without its images (so nothing is sent to Gemini; image 404s are expected and not counted as problems) and records how the committed code (HEAD) reads it.
3. `baseline-diff` must report no missing records. Then make one edit per project through the UI, `reload`, and run `baseline-diff` again: only the edits you made may appear.

End a tier-2 report by suggesting a sweep when a feature area looks finished or the change touched shared foundations (`App.jsx` save queue, `server/project-store.js`, storage format).

## 1. State the claim before editing

Write the claim before touching code, so it describes what the owner asked for rather than what got built. One or two sentences a non-programmer can check: the condition, the action, and the observable result, for example "On the Reading Study page, adding a to-do and reloading shows it in the open list, and it is saved in projects.json." Vague claims ("search is better") need a measurable form. Ask the owner only when what they want is unclear.

## 2. Launch and doctor

```bash
node $C up          # fixtures → /tmp/dashboard-verify; API :3101, Vite :5273, Chromium CDP :9333
node $C doctor      # must print "ok": true before any driving
```

The instance never touches the owner's dev server (5173/3001) or `data/projects.json`; doctor checks the latter by fingerprint. Vite serves the working tree, so code edits show up after `open` or `reload` without restarting. Restart (`down`, then `up`) after changing `server/` code or when you need fresh fixtures, since the API builds its search index at start.

`up --semantic` uses the real Gemini key for search-by-meaning checks. Default runs send an invalid key, so the UI shows its keyword-only fallback message.

## 3. Drive through the user path

Read the feature file for the area you changed under `features/`, then drive the entry points the change can affect. Tier 2 stops there; the full walk belongs to tier 3.

```bash
node $C open "/?project=verify-alpha" --viewport desktop
node $C snapshot --css .todo-panel                      # see names before clicking
node $C fill --label "Add a task" --value "Book eye tracker"
node $C press Enter --label "Add a task"
node $C reload
node $C data --project verify-alpha                     # the saved truth
node $C screenshot todos-after-reload
```

- Target elements by role and accessible name (`--role button --name "New board"`) or label. Fall back to `--css` only for things without a name.
- Every command prints `ok` and `problems`. Console errors, failed requests, a failed save, and error banners make `ok` false and are listed in `problems`. When the path under test is meant to fail (an empty title being refused), `ok: false` is the expected result: say so in the report rather than treating it as success or noise.
- Confirm dialogs (deletes) are dismissed unless you pass `--dialog accept`; both cases are worth driving.
- `eval` is for reading state after a user action. Performing the action itself through `eval` is not proof.

Viewports: `desktop` 1440×900, `narrow` 900×1000 (the stacked layout below 1000px), `ipad-landscape` 1180×820, `ipad-portrait` 820×1180 in Chromium. `webkit-shot NAME [path] [--portrait]` renders the page in WebKit with an emulated iPad Pro 11 and touch. Neither is a real iPad: touch gestures, Safari chrome, and the on-screen keyboard stay unverified unless the owner checks on the device.

## 4. Proof bar

- Show the action and the resulting state, not just a page that opens.
- Check side effects: `reload` and look again, and read `data` for the saved fields. A "saved" indicator alone is not proof.
- Cover the success, cancel, empty, and persistence paths the change can affect. Name any path you could not reach and why.
- Screenshot the states the owner should look at, with names that say what they show (`board-after-rename`, not `shot1`).

## 5. Report

Open with the owner's request in their own words, quoted as given, then the claim you wrote from it, so they can see at a glance whether the claim drifted from what they asked. Then one verdict for the claim:

- **VERIFIED**: driven through the UI, the saved data agrees, no unexplained `problems`, and `down` reported `yourDataUntouched: true`.
- **NOT VERIFIED**: the behavior is missing or wrong. Say what happened instead.
- **INCONCLUSIVE**: the check could not run or could not distinguish the outcomes. Say what blocked it.

Then list, in plain language: what you drove, the screenshot paths, and what you did not verify. Real iPad hardware, paste and drag-and-drop of files, and search by meaning without `--semantic` always go on that list when the change affects them.

Once the claim is proven, stop. Broaden or repeat checks only when new changes, failures, or open concerns justify it.

## Checks alongside the drive

- `npm run lint` and `npm run build` for code changes; `node --test test/search.test.js` for search changes. Necessary, never sufficient.
- Write automated tests where logic can break quietly: search ranking, board layout rules, storage validation. Skip tests that only mirror the implementation of a reversible, low-impact change.

## 6. Clean up

```bash
node $C down        # stops only the processes "up" started, deletes /tmp/dashboard-verify, rechecks data/projects.json
```

`down` checks each recorded pid is still a verification process before stopping it, and compares `data/projects.json` with its fingerprint from `up`; `yourDataUntouched: false` is a finding to report to the owner. Evidence stays in `.verify/evidence/<run>/` (git-ignored): screenshots plus `commands.jsonl`, one line per command with its result. Run `down` after failed attempts too, so no ports or processes are left behind.

## Feature map

`features/README.md` indexes one file per feature area. Each file answers, from the user's point of view, what exists, how a user reaches it, how to drive it with this CLI, and what tends to mislead. Feature files are brought up to date in tier-3 sweeps, not on every commit; while features are still moving, per-commit updates are mostly churn. A tier-2 change that adds a whole new feature area may add a short file for it. When the app and a feature file disagree, decide which is wrong: fix the file for drift, report the app for a regression.

## Gotchas

- `--label Title` also matches "Project title"; add `--exact`, or scope with `--within dialog`.
- Two search boxes can share a name when a dialog is open; use `--role searchbox`.
- Keyboard moves on board cards are blocked by collisions: nudging a card into a neighbour does nothing. Move toward free space.
- Express refuses to serve files under a dot-directory, which is why the scratch instance lives in `/tmp` and not in `.verify/`.
- Fixture IDs start with `verify-`; doctor relies on that to prove the API is not reading real data.
