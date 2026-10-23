# Radical Crucible

Radical Crucible tests the product itself, beyond what a scenario's test can
say: `radical fuzz` checks the system's rules under random sequences of
actions, `radical harden` turns a finding into a test that is bound to the
model, and `radical explore` runs the mechanical parts of an exploratory round
in which agents use the product as a user would. All three are commands of the
`radical` CLI (`apps/cli`), driven by `crucible.json` in the folder you run them
from. Findings are files in the findings folder (`crucible/findings/F-0001.md`).

## How a cycle runs

A cycle finds bugs, re-runs each before anyone reads it, records it, fixes it
with a test that fails without the fix, checks that test, and binds it to the
model. The CLI does what needs no judgement, agents search and fix, the
maintainer decides.

```
 the model: requirements and scenarios say what must hold
        │
        ▼
 SEARCH     radical fuzz      random sequences of actions on the store,
                              the rules checked after every step
            radical explore   agents use the product as a user would,
                              each run in an area of its own
        │
        ▼
 CONFIRM    explore verify    every script of a run re-run on a fresh page
        │
        ▼
 RECORD     explore record    crucible/findings/F-NNNN.md, open
                              (a question waits for the maintainer)
        │
        ▼
 FIX        a fix round       agents in parallel worktrees, the test first
        │
        ▼
 GATE       harden --gate     fails without the fix, passes with it,
                              passes several runs at once
        │
        ▼
 BIND       the model         the test named by its scenario, the
                              requirement's text updated; the finding fixed
        │
        ▼
 CI         radical check     every test the model names exists and passes
```

1. **An exploratory round** (the `crucible-explore` skill).
   `radical explore prepare` builds the product once and gives every run a
   folder, ports and a prompt with its area. The round's brief names what
   changed since the last round, in the code and in the model, the open
   findings, the rules and the form of the report. The agent session starts
   one agent per run. Each writes Playwright scripts, looks for what no test
   describes, changes nothing in the repository, and ends with a report whose
   JSON block holds at most three findings.
2. **Confirm and record.** `radical explore verify` serves the run's build
   (Studio and the Hub) and runs every script again; what a script does not
   show does not reach the maintainer. `radical explore record` writes each
   finding with its steps, expected and actual, the commit, and a copy of its
   script and screenshot. A question (which behaviour is meant?) is asked of
   the maintainer; the decision is written into the finding, and into the
   model with the fix.
3. **A fix round** (the `crucible-fix` skill). The findings are grouped so
   that groups touch few files in common, and each group gets a git worktree
   and a branch. For each finding an agent writes the test, checks that it
   fails for the finding's reason, fixes the cause (and the same pattern
   elsewhere), and gates the test. E2E tests run one worktree at a time,
   through a lock: the suite uses fixed ports.
4. **The gate.** `radical harden --gate --test "<file> › <describe> › <name>"`
   copies the source files changed since the base aside and sets them back:
   the test must fail. It puts them back: the test must pass. Then it must
   pass several runs at once, so a flaky test does not reach CI. For an e2e
   test the runner's `build` is made before each of the first two runs, and
   the runs at once are one Playwright run. The working tree is left as it
   was, also after Ctrl+C; nothing is ever stashed.
5. **Merge, model, CI.** The group branches are merged into one and checked
   as CI checks them (typecheck, the test reports, the full e2e suite). One
   writer updates the model: each new test named by its scenario, each
   requirement whose behaviour changed rewritten. Each finding is set to
   `fixed` with its test, and `radical check` makes sure every test the model
   names exists and passes. The branch is pushed when the maintainer agrees.

A finding's status:

| Status | Meaning |
|---|---|
| `open` | a confirmed bug |
| `question` | waits for the maintainer's decision |
| `hardened` | has a test bound to a scenario (a fuzz finding, by its own steps) |
| `fixed` | fixed, with its test |
| `intended` | decided to be meant, written down in an ADR or a requirement |

Who does what:

| Part | Done by |
|---|---|
| Builds, ports, briefs, re-runs, records, the gate | the CLI (`radical explore`, `radical harden`) |
| Searching and fixing | agents, one per run or per group |
| Grouping, merging, the model, CI, the report | the agent session that runs the cycle |
| Questions, starting a round, pushing | the maintainer |

Round 170–175 (2026-10-22) is an example. Six runs found 27 confirmed
findings. Eight groups fixed them, with 63 new tests, and the fixes went in
as one pull request (#245). The round also found what the gate could not yet
do for e2e tests, which #247 adds.

## radical fuzz

A test of a scenario proves that one sequence of actions works. A fuzz file
checks the system's rules wherever an action can break them: it does random
sequences of actions (add, delete, drag, undo, reload, an agent's write, …)
and checks the rules after every step (Undo gives back the state before, a
reload changes nothing, nothing points at nothing, …).

`radical fuzz` runs the fuzz files `crucible.json` lists:

```json
{
  "findings": "crucible/findings",
  "fuzz": [{ "file": "packages/ui/tests/invariants.test.ts", "cwd": "packages/ui" }]
}
```

Each file runs with `npx vitest run` in its `cwd`, or with its own command. A
fuzz file names its worlds (the models a run starts from, each with the seed
and the number of runs CI uses), its actions, its rules and its known
failures. It reports a test case for each world, and one for each rule of each
world (`undoRestores holds`), so a scenario or a fitness function can name one
rule in its Tests and `radical check` finds it.

| Option | What it does |
|---|---|
| `[plan]` | `ci` (default): each file's fixed seeds and runs, the same sequences every time. `night`: a random seed (the summary says which) and 2000 runs of each world. |
| `--world`, `--seed`, `--runs`, `--length` | One world of each file, a seed, the runs of each world, the longest sequence of actions. |
| `--survey` | Goes on after each failure, and writes each one whose signature (its rule, its last action and the shape of what differs) no finding has yet as an open finding. |
| `--replay <id>` | Runs a finding again with its world, seed, path and length, without shrinking: after a fix, or on another commit. |
| `--no-known`, `--no-shrink` | Known failures filter nothing (does one still happen?); the first failure is reported as found. |
| `--report <dir>` | A Vitest JSON report of each file, for `radical check --report`. |
| `--config <file>` | The settings. Default: `crucible.json` in the working directory. |

A failure shrinks to the shortest sequence that breaks the rule, and names
the rule, each step as it resolved and what differs, with the seed and path
that replay it. A known failure (a bug not fixed yet, described in the fuzz
file by its rule, its last action, the actions before it and the paths of
what differs) ends its run quietly, so CI stays green until the fix; the
summary says how often each was hit, and which no run hit any more.

A finding holds the rule, the signature, the fuzz file, world, seed, path and
length, the commit and the day, then the steps and what differs. It starts
`open`; a test bound to a scenario makes it `hardened`, the fix `fixed`, a
decision that the behaviour is meant `intended`.

Exit status: 0 every file passed, 1 one failed, 2 `radical fuzz` could not run.

## radical harden

A finding is done when a test that fails on it is bound to the model.

For a finding of a fuzz file, the test is its own steps:
`radical harden F-0003 --scenario "Undo is exact"` marks it hardened, and from
then on the fuzz file replays its shrunk sequence as a test case of its own
(`F-0003 stays fixed: …`), once, without the known failures, so it fails until
the bug is fixed. The command prints the test id to add to the scenario's
Tests; it never changes the model's files. A finding from an exploration has
no steps to replay: its test is written by hand, then gated.

`radical harden --gate` checks a test before it is bound, the way a fix should
be checked: with the source files changed since the base commit set back to
it (`--base`, by default where the branch left `origin/main`), the test must
fail; with them put back, it must pass; and it must pass several runs at once
(`--runs`, 5 by default), so a flaky test does not reach CI. Give a finding
(`radical harden --gate F-0003`) or any test
(`--test "apps/e2e/tests/studio/views.spec.ts › …"`). Tests, findings and
`crucible.json` are not set back, and the working tree is left as it was,
whatever happens: interrupted, it stops the test, puts the changed files back
and ends with status 2. A test runs through the runner `crucible.json` gives
for its folder, else with `npx vitest run` in its package:

```json
"runners": [{ "files": "apps/e2e/", "cwd": "apps/e2e",
              "command": ["npx", "playwright", "test", "{file}", "-g", "{name}", "--reporter", "line"],
              "build": [["npm", "run", "build:web"], ["npm", "run", "build:hub"]],
              "repeat": ["npx", "playwright", "test", "{file}", "-g", "{name}",
                         "--repeat-each", "{runs}", "--workers", "{runs}", "--reporter", "line"] }]
```

A test of a build (an e2e test runs the web build) needs that build made
from the files it runs on: the runner's `build`, run from `crucible.json`'s
folder, is made before the run without the fix and before the run with it.
Its `repeat` makes the runs at once one run of that command (`{runs}` the
number), for tests whose runs cannot go side by side, as Playwright's web
servers on fixed ports cannot. Name the test with its describe blocks when it
has them (`"<file> › <describe> › <name>"`): Vitest's `-t` and Playwright's
`-g` get the title with its parts joined by spaces, as they match it.

Exit status: 0 done (the gate passed), 1 the gate failed, 2 `radical harden`
could not run or was interrupted.

## radical explore

What no rule can say (where the camera goes, what a label says, what a user
expects to see) is found by exploration: agents use the product as a user
would, each in its own area, briefed by a document of the project's that says
how to tell that something is wrong (`docs/EXPLORATORY-TESTING.md` here).
`radical explore` does the parts of a round that need no judgement; a coding
agent's session starts the agents and talks to you (in this repository, the
`crucible-explore` skill of Claude Code).

- `radical explore prepare --runs 5 --areas "layout under edits; milestones and undo"`
  builds the project once (the builds `crucible.json` names), copies what the
  runs need into the round's folder (`.crucible/rounds/round-70-74/`), so that
  a rebuild during the round changes nothing for them, and gives each run a
  folder, ports of its own (4570, 4670 and 4770 for run 70) and a prompt with
  its area. The round's brief names the commit, what changed since the last
  round, the open findings, the setup, the rules and the form of the report.
- `radical explore verify 70 "f1-row.mjs 2" "f2-undo.mjs"` serves run 70's
  build on its ports, runs each reproduction script from the run's folder,
  shows what it printed and its exit status, and stops the servers, so every
  finding is re-run before anyone reads it.
- `radical explore record run-70/REPORT.md` writes the findings of a run's
  report (its JSON block) to the findings folder, as `open` or, for a
  question to decide, `question`, each with a copy of its script, the helpers
  it imports and the screenshot it names. A script that names absolute paths
  of the repository or the round runs only where the round ran: record warns
  about each one.

`crucible.json`'s `explore` says how: the brief, the documents of known
issues, the model folder, the builds, what to copy, the commands that serve a
run's build (each with `{port}`, `{hubPort}` or `{otherPort}` and `{build}`,
and the port it answers on), the first port, and rules of the project's for
every run.

## In this repository

- `npm run fuzz` runs the fuzz files of `crucible.json`.
- The `crucible-explore` skill runs an exploratory round; the `crucible-fix`
  skill fixes a set of findings in parallel worktrees, each fix gated by
  `radical harden --gate`.
- Findings live in `crucible/findings`.
