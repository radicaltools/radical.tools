---
name: crucible-fix
description: Fix a set of Radical Crucible findings (crucible/findings, or items of docs/IMPROVEMENTS.md) with agents in parallel git worktrees, each fix with a test that fails without it, gated by radical harden. Use when the user asks to fix the findings of a round, "popraw wszystkie", or to fix several open findings at once.
---

# A fix round

Each fix comes with a test that fails without it and is bound to a scenario
in the model. Agents fix groups of findings in parallel, each in its own git
worktree and branch; you merge the branches, check the whole, and update the
model as the single writer.

## 1. Group

Group the findings so that groups touch few files in common (the store,
`packages/ui/src/store/diagramStore.ts`, is shared by most: keep changes
local there). Six to eight groups worked. A finding that is the same pattern
as another goes in the same group: the fix sweeps the pattern, not the one
place.

## 2. Worktrees and brief

For each group: `git worktree add ../rd-fix-<g> -b fix/<round>-<g>` from the
branch the round tested, and `npm ci` in it. Write one shared brief and one
file per group (its findings, the decisions that stand). The brief says:

- work only in your worktree; never in the main checkout or another one;
- per finding: write the test first (a unit test where the bug lives in the
  store or a package, an e2e test where it lives in the browser), check it
  fails for the finding's reason, fix the cause, then gate it:
  `node apps/cli/dist/index.js harden --gate --test "<file> › <name>"` (or
  `harden --gate F-NNNN` for a fuzz finding, whose test is its own steps
  after `harden F-NNNN`); the gate sets the changed source files back, so it
  never needs a stash (never use git stash); name a test with its describe
  blocks as the report does (`<file> › <describe> › <name>`); an e2e test's
  gate rebuilds the web and Hub builds before each run (the runner's `build`
  in `crucible.json`) and runs the runs at once as one Playwright run, so it
  takes minutes, and it takes the e2e lock like any e2e run;
- remove the finding's KNOWN entry from the fuzz file with the fix, and run
  the fuzzer more (`node apps/cli/dist/index.js fuzz night --world <model> --runs 300`):
  a new violation of the same rule elsewhere is the same pattern, fix it too;
- e2e tests one worktree at a time, through a lock
  (`until mkdir "$LOCK"; do sleep 10; done` … `rm -rf "$LOCK"`): the suite
  uses fixed ports;
- do not edit `architecture/` or the findings: report model texts that should
  change, and one sentence per finding for its file;
- commit on your branch; the final message is the report.

## 3. Merge and check

Merge the group branches into one branch, resolve conflicts (keep one
mechanism where two groups solved the same thing), then run what CI runs:
`npm run check:workspaces && npm run typecheck && npm run test:reports`,
the full `npm run e2e` (merge-only failures happen), then
`npm run check:architecture`.

## 4. Model and findings

As the only writer of the model (the radical-architecture MCP server, or a
stdio client of the worktree's own server when the main checkout is someone
else's), bind each new test to its scenario (add one under the requirement
when none fits), and update the texts the fixes changed. Set each finding to
`fixed` with its test. Then commit, and ask the user before pushing.
