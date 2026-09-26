# Project working agreement

## Product and implementation

- Build a personal project dashboard that is useful on Mac and iPad while keeping the React code approachable for learning.
- Work within the current JavaScript React/Vite frontend and local Express API. Prefer simple components, native browser features, and existing dependencies; add abstractions or tooling when the requested feature needs them.
- Persist project content and layouts through the API to `data/projects.json` on the Mac. Keep saved state available after refresh and across clients; reserve browser storage for device-specific preferences.
- Treat `data/projects.json` as user data. Preserve existing records when changing the storage format; write checks run against the verification skill's disposable copies (see Verification).
- Keep UI changes usable with touch and keyboard. When responsive behavior changes, check the affected desktop, narrow, and iPad-sized layouts (see Verification).
- For visual design work, read `DESIGN.md` and use it as the project's visual source of truth. Update it when intentionally changing the visual direction; skip it for unrelated code changes.

## Sources and decisions

- Read the code and configuration relevant to the change. Use `package.json` for commands and dependencies; consult `vite.config.js` and `server/` for development routing and persistence.
- For component boundaries, state, effects, and data flow, use the [React docs](https://react.dev/learn) when the code does not settle the question. Keep state tied to the dashboard's actual behavior.
- For layout and interactions, use semantic HTML and responsive CSS; consult [MDN](https://developer.mozilla.org/en-US/docs/Learn_web_development) for browser behavior. Check [Baseline](https://web.dev/baseline) before relying on a newer Web feature across Mac and iPad browsers.
- When an external design resource is needed, consult `design/resources.md`.
- For controls, focus, keyboard use, contrast, and feedback, apply the relevant [W3C/WAI guidance](https://www.w3.org/WAI/standards-guidelines/wcag/). Prefer native HTML controls where they fit.
- For API, file-storage, or dependency behavior, inspect the current code first, then use that tool's official documentation for the specific uncertainty. Consult [OWASP](https://owasp.org/projects/top-ten) when adding authentication or exposing the app beyond its private access path. Read only the guidance relevant to the change.
- Resolve routine implementation choices and continue through implementation, relevant verification, and fixes until the requested behavior works. Ask when a missing product decision materially changes the result; report a concrete blocker if completion is impossible.

## Git workflow

- After verification, review the staged diff and commit only task-related files; exclude user data, secrets, and unrelated changes.
- Write a concise English imperative commit subject that names the concrete change. Add a body only when the reason or migration needs explanation; avoid vague titles and unverified claims.
- When asked to sync, fetch and reconcile remote changes, push the current branch, and verify the remote ref. Never force-push, rewrite published history, or discard work without explicit authorization.

## Verification and testing

The owner reviews behavior, not code, and the project is early: features change fast, so verification scales with the change instead of running in full every time. How to verify, what counts as proof, and how to report live in `.claude/skills/verify-dashboard/SKILL.md`; read it when a change reaches tier 2 or 3.

- **Tier 1, small changes** (copy, spacing, colour, a local fix that does not change what the user can do or what gets saved): run `npm run lint` and `npm run build`, add one screenshot when it is visual, and move on. When unsure, or when the change touches `server/` or saving, it is tier 2.
- **Tier 2, a feature or behavior change**: verify it automatically as part of the task. Drive only the changed behavior on the skill's disposable instance, read back the saved data, and report a VERIFIED, NOT VERIFIED, or INCONCLUSIVE verdict with its claim and evidence. A storage-format change also runs the skill's real-data check (`up --from-real-data`, `baseline-diff`), after backing up `data/projects.json` before the first edit.
- **Tier 3, milestone sweeps**: run only when the owner asks. Walk the whole feature map and bring the feature files up to date. Suggest one at the end of a report when a feature area looks finished or the change touched shared foundations (the save queue in `App.jsx`, `server/project-store.js`, the storage format).
- Write the claim before editing code. Ask the owner about it only when what they want is unclear; the report opens with their request quoted as given, followed by the claim, so drift is visible.
- Verification always runs on the disposable instance (`control-dashboard.mjs up`, then `down`). The owner's `npm run dev` instance and `data/projects.json` stay untouched.
