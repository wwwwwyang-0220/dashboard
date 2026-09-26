# To-do list

A short task list on the right side of each project page. Open tasks are listed first; completed ones fold away under "Completed".

## Sub-features

- `add`: type in "Add a task" and press Enter.
- `complete`, `reopen`: tick or untick the checkbox; completed tasks move into the Completed fold, newest first.
- `edit`: click a task's text and type; saves on leaving the field or Enter.
- `delete`: the × button, or clear the text and leave the field.
- `completed-fold`: "Completed · N" opens and closes; remembered on this device.
- `empty`: "Nothing to do yet." when there are no tasks at all.

## How to get to it (user POV)

On any project page, the **To-do** panel beside the library (below it on narrow screens).

## Driving it with control-dashboard

- Add: `fill --label "Add a task" --value "Book eye tracker"`, `press Enter --label "Add a task"`. The panel count goes from "2 open" to "3 open".
- Complete: `click --role checkbox --name "Complete Pilot the stimulus list"`. It leaves the open list; "Completed · 2" appears.
- Reopen: `click --role button --name "Completed · 2"`, then `click --role checkbox --name "Reopen Pilot the stimulus list"`.
- Delete: `click --role button --name "Delete Email the lab about room booking"`.
- Empty state: `open "/?project=verify-beta"`, `snapshot --css .todo-panel` shows "Nothing to do yet."
- Proof: `reload`, `snapshot --css .todo-panel`, `data --project verify-alpha` (check `done` and `doneAt`), `screenshot todos-after-reload`.

## Gotchas

- Adding and ticking save immediately; typing in an existing task saves only when you leave the field. A proof of editing must leave the field (`press Enter`) before `reload`.
- An emptied task is deleted when you leave it, not saved as blank.
