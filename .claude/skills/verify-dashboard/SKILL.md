---
name: verify-dashboard
description: "Prove a dashboard change works by driving a disposable copy of the app in headless Chromium (and WebKit for an iPad-sized check): launch, click and type through the real UI, read back saved data, and capture screenshots. Use after any change to the dashboard's UI, API, or saved data, for /verify-dashboard, or when asked to show that a dashboard feature works."
---

# Verify the dashboard

The owner of this app reviews behavior, not code. A change is done when a claim about what the user sees has been driven through the real UI, the saved data agrees, and the evidence is handed over with an honest verdict.

All commands run from the repo root through one CLI. `--help` is canonical.

```bash
C=".claude/skills/verify-dashboard/control-dashboard.mjs"
node $C --help
```

Node comes from fnm. If `node` is missing, `export PATH=~/.local/share/fnm/node-versions/v24.21.0/installation/bin:$PATH`.

## 1. State the claim first

Before editing code, write the claim in one or two sentences a non-programmer can check, and get the owner's agreement when the task came from them. Name the condition, the action, and the observable result, for example "On the Reading Study page, adding a to-do and reloading shows it in the open list, and it is saved in projects.json." Vague claims ("search is better") need a measurable form before work starts.

## 2. Launch and doctor

```bash
node $C up          # fixtures → /tmp/dashboard-verify; API :3101, Vite :5273, Chromium CDP :9333
node $C doctor      # must print "ok": true before any driving
```

The instance never touches the owner's dev server (5173/3001) or `data/projects.json`; doctor checks the latter by fingerprint. Vite serves the working tree, so code edits show up after `open` or `reload` without restarting. Restart (`down`, then `up`) after changing `server/` code or when you need fresh fixtures, since the API builds its search index at start.

`up --semantic` uses the real Gemini key for search-by-meaning checks. Default runs send an invalid key, so the UI shows its keyword-only fallback message.

## 3. Drive through the user path

Read the feature file for the area you changed under `features/`, then drive every entry point it lists that the change can affect.

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
- Every command prints `saveState`, any `alert` text, `dialogs` answered, and `consoleErrors` (including failed HTTP requests). A non-empty `consoleErrors` or `saveState: "failed"` is a finding, not noise.
- Confirm dialogs (deletes) are dismissed unless you pass `--dialog accept`; both cases are worth driving.
- `eval` is for reading state after a user action. Performing the action itself through `eval` is not proof.

Viewports: `desktop` 1440×900, `narrow` 900×1000 (the stacked layout below 1000px), `ipad-landscape` 1180×820, `ipad-portrait` 820×1180 in Chromium. `webkit-shot NAME [path] [--portrait]` renders the page in WebKit with an emulated iPad Pro 11 and touch. Neither is a real iPad: touch gestures, Safari chrome, and the on-screen keyboard stay unverified unless the owner checks on the device.

## 4. Proof bar

- Show the action and the resulting state, not just a page that opens.
- Check side effects: `reload` and look again, and read `data` for the saved fields. A "saved" indicator alone is not proof.
- Cover the success, cancel, empty, and persistence paths the change can affect. Name any path you could not reach and why.
- Screenshot the states the owner should look at, with names that say what they show (`board-after-rename`, not `shot1`).

## 5. Report

End with one verdict for the claim:

- **VERIFIED**: driven through the UI, the saved data agrees, no console errors.
- **NOT VERIFIED**: the behavior is missing or wrong. Say what happened instead.
- **INCONCLUSIVE**: the check could not run or could not distinguish the outcomes. Say what blocked it.

Then list, in plain language: what you drove, the screenshot paths, and what you did not verify (always include iPad hardware when layout or touch changed). Run `npm run lint` and `npm run build` for code changes as well; they are necessary but never sufficient.

## 6. Clean up

```bash
node $C down        # stops only the processes "up" started, deletes /tmp/dashboard-verify
```

Evidence stays in `.verify/evidence/<run>/` (git-ignored): screenshots plus `commands.jsonl`, one line per command with its result. Run `down` after failed attempts too, so no ports or processes are left behind.

## Feature map

`features/README.md` indexes one file per feature area. Each file answers, from the user's point of view, what exists, how a user reaches it, how to drive it with this CLI, and what tends to mislead. When a change adds or alters user-visible behavior, update the matching feature file in the same commit. When the app and a feature file disagree, decide which is wrong: fix the file for drift, report the app for a regression.

## Gotchas

- `--label Title` also matches "Project title"; add `--exact`, or scope with `--within dialog`.
- Two search boxes can share a name when a dialog is open; use `--role searchbox`.
- Keyboard moves on board cards are blocked by collisions: nudging a card into a neighbour does nothing. Move toward free space.
- Express refuses to serve files under a dot-directory, which is why the scratch instance lives in `/tmp` and not in `.verify/`.
- Fixture IDs start with `verify-`; doctor relies on that to prove the API is not reading real data.
