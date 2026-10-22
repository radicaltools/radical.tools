---
name: crucible-explore
description: Run an exploratory round of Radical Crucible on this repository - agents that look for bugs no test describes, each in its own area, every finding re-run before the user sees it and recorded in crucible/findings. Use when the user asks for exploratory runs, an exploratory round, agents that test the product, or "uruchom N agentów" to look for bugs.
---

# An exploratory round

Agents explore the product as a user would, guided by
`docs/EXPLORATORY-TESTING.md` (how to tell that something is wrong, where to
look, how to drive it). `radical explore` does the deterministic parts; you
start the agents and talk to the user. The user decides what is fixed and
what is a question; nothing is fixed, committed or pushed in a round.

## 1. Prepare

Build the CLI if it is not (`npm run build -w @radicaltools/cli`), then:

```sh
node apps/cli/dist/index.js explore prepare --runs <n> --areas "<area>; <area>; …"
```

- Choose the areas from what changed: `prepare` prints the model's changed
  elements by area (also in the brief), and `git log` since the last round.
  Test changes next to their neighbours; about half of each round used to be
  the same pattern left in another place. Give each run a different area; at
  most two findings per area are worth more than a third.
- Runs are numbered after the last round in `.crucible/rounds/`. The rounds
  before Radical Crucible went up to run 69: the first time, pass
  `--from 70`.
- The build is copied into the round's folder, so a rebuild in the checkout
  during the round changes nothing for the runs. `--no-build` copies what is
  built.
- Read the brief it wrote (`.crucible/rounds/round-<from>-<to>/BRIEF.md`)
  once before starting the agents.

## 2. Start the agents

One Agent per run, all in one message, so they run at once. Each prompt:
"Read <run folder>/PROMPT.md and follow it." (the prompt points at the
brief). Up to 20 at once worked on this machine (keep one browser per run);
the API's session limit can stop them all: resume each with SendMessage
after the reset. Subagents cannot write a report file: the report is their
final message, ending with the JSON block the brief asks for.

## 3. Verify every finding before showing it

For each run, save its final message to `<run folder>/REPORT.md`, then re-run
each finding's script:

```sh
node apps/cli/dist/index.js explore verify <run> "f1-name.mjs args" "f2-name.mjs"
```

It serves the run's build on the run's port, runs the scripts from the run's
folder and stops the server. A finding whose script does not show the bug
goes to "Seen once", not to the user. Agents' guesses about causes are
sometimes narrower than the bug: look at the code before repeating one.

## 4. Record

```sh
node apps/cli/dist/index.js explore record <run folder>/REPORT.md
```

Edit the report's JSON first if verification dropped or changed a finding.
Findings go to `crucible/findings/F-NNNN.md` (open), questions with status
`question`, each with a copy of its script. Duplicates of open findings or of
`docs/IMPROVEMENTS.md` items are left out by you, not by the command.

## 5. Tell the user

Per run: what it covered, the findings (title, one line, the finding id) and
how many were siblings of earlier fixes. Then walk through the questions with
AskUserQuestion, four per batch, your recommendation first; record each
decision where the behaviour is specified (the requirement or ADR in the
model, the manual) and set the finding to `intended` or `open`.

Fixing comes only when the user says so: see the crucible-fix skill.
