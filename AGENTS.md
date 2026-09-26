# Project working agreement

## Product and implementation

- Build a personal project dashboard that is useful on Mac and iPad while keeping the React code approachable for learning.
- Work within the current JavaScript React/Vite frontend and local Express API. Prefer simple components, native browser features, and existing dependencies; add abstractions or tooling when the requested feature needs them.
- Persist project content and layouts through the API to `data/projects.json` on the Mac. Keep saved state available after refresh and across clients; reserve browser storage for device-specific preferences.
- Treat `data/projects.json` as user data. Use disposable data for write verification. Preserve existing records when changing the storage format.
- Keep UI changes usable with touch and keyboard, and check the affected desktop and tablet layouts when changing responsive behavior.
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

- Match verification to the change's impact. Do not write tests for reversible, low-impact changes that merely mirror the implementation. When tests are warranted, keep them meaningful. Run the checks appropriate to the change; once they pass, broaden or repeat only if new changes, failures, or unresolved concerns justify it.
- Use `npm run dev` to run the API and frontend together. Use `npm run lint` and `npm run build` when relevant to code or build changes. For interaction or persistence changes, verify the affected user flow, including refresh when saved state is involved.
- The owner reviews behavior, not code. For any user-visible or saved-data change, follow `.claude/skills/verify-dashboard/SKILL.md`: state the claim in plain words before editing, drive it through a disposable instance with `control-dashboard.mjs`, and report a VERIFIED, NOT VERIFIED, or INCONCLUSIVE verdict with screenshot paths and what was not verified.
- Keep `.claude/skills/verify-dashboard/features/` in step with the app: when a change adds or alters user-visible behavior, update the matching feature file in the same commit.
