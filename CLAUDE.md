@AGENTS.md

## Git workflow

- The user wants **all work to land on the `master` branch**, not only the
  per-session working branch. Make sure changes reach `master` after every push.
  (In the web sandbox a direct `git push` to `master` is refused by the git
  proxy, so `master` is brought up to date from the session branch via the
  GitHub API / a merge.)

