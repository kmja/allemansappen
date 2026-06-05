@AGENTS.md

## Git workflow

- The user wants **all work to land on the `main` branch**, not only the
  per-session working branch. After pushing the session branch, also run
  `git push origin HEAD:main` so `main` stays in sync with every change.

