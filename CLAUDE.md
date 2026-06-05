@AGENTS.md

## Git workflow

- The user wants **all work to land on the `master` branch**, not only the
  per-session working branch. After pushing the session branch, also run
  `git push origin HEAD:master` so `master` stays in sync with every change.

