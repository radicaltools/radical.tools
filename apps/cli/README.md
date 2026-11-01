# radical CLI

The `radical` command line for Radical Markdown model folders.

## Install

Requires Node.js 20.11 or later and Git for `diff` and `hooks`.

```sh
npm install -g @radicaltools/cli
radical --help
radical check path/to/model
```

Or run it without a global install:

```sh
npx @radicaltools/cli check path/to/model
```

## radical setup

Connects your coding agents to a model folder, step by step:

```sh
npx @radicaltools/cli setup            # asks for the folder, the agents and the hooks
npx @radicaltools/cli setup architecture --client claude-code --client codex --yes
```

No Node.js yet? Start from an empty folder with the launcher, which finds Node.js or
downloads it, then runs the CLI:

```sh
mkdir my-system && cd my-system
curl -fsSLO https://radical.tools/radical.sh && sh radical.sh setup      # macOS, Linux
curl.exe -fsSLO https://radical.tools/radical.cmd && radical.cmd setup  # Windows
```

The launcher (`radical.sh`, `radical.cmd`) takes Node.js 20.11 or later with `npx`
beside it from the `PATH`, else from `~/.radical/node`. With neither, it asks (or takes
`--yes`) and downloads the latest Node.js 24 for the platform from nodejs.org into
`~/.radical/node`, checked against its SHA-256 sum. It runs any command:
`sh radical.sh check architecture`, and `sh radical.sh mcp --folder …` runs the MCP
server without asking anything. `radical setup` run through it pins its version line
(`default_version`, `DEFAULT_VERSION` in `radical.cmd`) to the CLI's, makes `radical.sh`
executable, and has every agent and the git hooks start the server and the CLI through
it, so they find the same Node.js. Commit it with the model; `RADICAL_VERSION=latest sh
radical.sh setup` moves the project to the latest release. `RADICAL_HOME` and
`RADICAL_NODE_MIRROR` change where Node.js goes and where it comes from.

1. **Node**: checks the version (20.11 or later).
2. **Folder**: a missing or empty folder becomes a new model (`--metamodel radical`, the
   default, or `c4`); a folder that holds other files and no `radical.md` is refused.
3. **Agents**: adds the MCP server for the folder to each agent's configuration, pinned
   to the CLI's version (`@radicaltools/mcp@<version>`), keeping every other entry.

   | Agent | File | Names |
   | --- | --- | --- |
   | Claude Code (`claude-code`) | `.mcp.json` at the top of the repository | `npx`, the folder by its path from the top |
   | VS Code (`vscode`) | `.vscode/mcp.json` at the top of the repository | `npx`, `${workspaceFolder}/<folder>` |
   | Claude Desktop (`claude-desktop`) | `claude_desktop_config.json` in the app's settings folder | `npx` by its absolute path, node's directory on `PATH`, the absolute folder |
   | Cursor (`cursor`) | `~/.cursor/mcp.json` | as Claude Desktop |
   | Codex (`codex`) | `~/.codex/config.toml` (or `$CODEX_HOME`) | as Claude Desktop, in `[mcp_servers.<name>]` |

   The project files are meant to be committed, so teammates get the server too. A user
   file is copied to `<file>.bak` before it changes. An entry that is already there is
   left alone; another server of the same name is replaced only when you say so
   (`--name <name>` adds this one beside it).
4. **Hooks**: `radical hooks install` for the folder, so Studio's *Changes on branch*
   has the branch's base (`--no-hooks` leaves them alone). Outside a git repository it
   asks, in a terminal, to start one in the working directory first.
5. **Check**: the checks of `--status` for the folder (`--no-check` skips them).

In a terminal each question shows its default; press Enter to take it. Without a
terminal, or with `--yes`, it asks nothing: the folder `architecture`, the agents it
finds installed, the hooks in a repository. `--dry-run` prints every change and writes
nothing. Exit status: 0 set up and checked, 1 a step or a check failed, 2 it could not run.

**Several models.** One server serves one folder. To connect more models to the same
agents, run setup once per folder with a name of its own:

```sh
radical setup payments/architecture --name radical-payments
radical setup billing/architecture  --name radical-billing
```

The agent sees each server's tools under its name (in Claude Code
`mcp__radical-payments__get_model_summary`), so they never collide; a name that says
which model it is helps the agent pick the right one. Without `--name` the second setup
finds `radical` taken and replaces it, asking first in a terminal (with `--yes`, it does not ask). Keep one server per folder: two
servers writing the same folder get in each other's way (Studio on the same folder is
fine).

### radical setup --status

Checks what an agent needs to work on a model folder, and changes nothing:

```sh
npx @radicaltools/cli setup --status architecture
sh radical.sh setup --status                       # through the launcher
```

It reports Node and the CLI's version; whether the folder reads as a model and the git
hooks save its base; every agent configuration that holds a Radical MCP server, with the
folder it serves, a command or folder that is not there, and a server pinned to another
version than the CLI's; then it starts each server configured for the folder, with the
agent's own command, arguments and environment, and asks it for `get_model_summary`
over stdio. `--no-start` only reads the configurations; `--timeout <s>` (default 120,
as npx may download the package first) limits each server. Without a folder it checks
the working directory, or `architecture` in it, when it holds a model, else every Radical
server configured. `--status` takes no option that would change something.
Exit status: 0 nothing is broken (warnings, marked `!`, allowed), 1 something is
(marked `✗`), 2 it could not run.

## radical export confluence

Export a particular wiki view from a Radical Markdown model folder. The full
view is exported, including its filter chain (for example, requirements with
their verifying scenarios), readable requirement sentences, Markdown fields
and links between elements. The last focused page and Single/Multi page reading
mode do not truncate the export. Local exports are complete documents.
Publishing defaults to a **page tree**: a landing page, requirement pages,
then their verifying scenario pages (or the selected view's own hierarchy).
A shared element has one page beneath its first parent and links from every
other parent. `--structure document` publishes one document instead.

Studio and the CLI use the same pure `@radical/common/wikiDocument` content
builder for view scope, hierarchy, visible fields, requirement prose and
relationships. React renders editors; the CLI serializes the document and
publishes it through the Confluence adapter.

Find a view and preview it without Confluence credentials:

```sh
radical export confluence architecture --list-views
radical export confluence architecture --view "Specification" --format html --output wiki-preview.html
radical export confluence architecture --view "Specification" --format markdown --output wiki.md
```

`--view` accepts an exact view ID or an unambiguous name. `--format storage`
(the default) produces Confluence storage XHTML; `markdown` produces a portable
document and `html` a standalone browser preview. Without `--output`, local
exports go to stdout. Output files must be outside the model folder; existing
files are never overwritten. `--source-url` adds a link back to the source
model or Studio wiki, and `--title` overrides the document/page title.

To publish to Confluence Cloud, set `CONFLUENCE_URL`, `CONFLUENCE_EMAIL` and
`CONFLUENCE_API_TOKEN` in your shell or CI secret environment, then run:

```sh
radical export confluence architecture --view "Specification" --publish --space-id 123 --parent-id 456
```

Use the numeric space ID, not its key. `--parent-id` is optional. `--url` can
override `CONFLUENCE_URL`; use a site URL such as `https://company.atlassian.net`
or `https://company.atlassian.net/wiki`. Use an Atlassian API token suitable
for basic authentication at that site and an account that can read and
create/update pages in the space.

To use a token kept under another environment variable name, add
`--token-env TEST_WORKSPACE_ATTLASIAN_KEY` (or your chosen variable name).

The command creates a landing page with the wiki's name, then finds and
refreshes it on subsequent runs. Every element page carries its own export
marker. Stable element-to-page IDs live in small content-property buckets
on the landing page, so renames preserve page IDs and publication can resume
on another computer. Publication first creates or recovers every destination,
preserving existing bodies and marking new pages as publication in progress.
Once all destinations exist, it fills their linked content and writes the
landing page last. Up to four writes run concurrently, with checkpoints
between batches. A failed run prints the landing page ID for resuming with
`--page-id 789`. A title collision with a handwritten page fails without
changing it. Updates verify ownership, use the current Confluence version
and report concurrent-edit conflicts. Rate-limit responses get bounded retries;
uncertain network failures are not retried automatically.

To move an existing managed export under another page, pass its root page
ID with `--parent-id`; its children follow it:

```sh
radical export confluence architecture --view "Specification" --publish --page-id 789 --parent-id 456
```

Use a destination parent in the same Confluence space. Changing the view's
hierarchy also moves its managed element pages on the next publication.
Elements removed from the view are reported and their old pages are retained.

**Radical remains the source of truth.** Publishing replaces the managed
page's body, including edits made to that body in Confluence. It does not
import Confluence changes, write source model files, or delete pages. A
source-of-truth notice and optional source link sit at the bottom of every
exported page, in a native Confluence Info panel (a note in HTML previews and
a blockquote in Markdown). Unchanged element pages
are skipped when their source hash and published Confluence version match.
Exports made by the earlier single-pass publisher are refreshed once to resolve
their forward links before unchanged pages can be skipped again.
Switching from tree to document leaves previously published child pages in
place. Absolute HTTP(S) image URLs are preserved; local
images and interactive mockup wireframes are not uploaded, and the command
reports unsupported assets. Data Center is not supported in this version.

Exit status: 0 exported/published, 2 could not export/publish. Credentials
are not accepted as command-line arguments or included in error output.
The transport follows Atlassian's [Cloud page API](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/).

## radical diff

```sh
radical diff path/to/model [--since <ref>] [--format json]
```

Lists what changed in the model folder since its version in git: the
elements and relations added, removed and changed, uncommitted edits
included, with each changed field's old and new value and each element's
place and relations (the component that satisfies a requirement, the
scenarios that verify it, the ADRs that constrain it). Only the model is
compared; views, positions, sizes and folding are left out. By default it
compares with the merge base of the current branch and the default branch
(`origin/main`, else `main`), so it shows every model change on the branch;
`--since HEAD` shows what changed since the last commit. The MCP server's
`get_changes` tool gives the same list to an agent that implements the
change. Exit status: 0 the list was written, 2 it could not be made (not a
git repository, an unknown ref).

`--save-base` also writes the model at the base (its elements and relations,
the commit, the branch and the time) to `.radical/base.json` in the folder,
out of git like the rest of `.radical/`. Studio has no git: it compares the
open model with that file as it is edited and shows the changes with
Changes on branch, in the list of views, on the properties card and in the
Inspector. `--quiet` prints nothing.

When the base is saved: a checkout (`post-checkout`), a commit
(`post-commit`), a pull or merge (`post-merge`), a rebase or an amend
(`post-rewrite`) once `radical hooks install` has added the hooks; an
agent's `get_changes` without `since`; and `radical diff --save-base` by
hand. A fetch, a reset or a stash saves nothing. Committing on a branch keeps
the base (the list is the whole branch); after the merge, switching to
`main` and pulling empties it. `--save-base --since HEAD` makes the last
commit the base, to list only what is not committed.

## radical hooks

```sh
radical hooks install path/to/model
```

Adds one marked line to the repository's `post-checkout`, `post-commit`,
`post-merge` and `post-rewrite` hooks that runs `radical diff <folder> --save-base --quiet`, so
the base Studio compares with follows the branch checked out, and then
`radical check <folder> --from-ci --quiet --detach`, which fetches the test
results of CI for the commit checked out in the background (a command of its
own, its output closed: a CLI built before `--from-ci` still saves the
base, and without the GitHub CLI nothing is fetched). The line goes
right after the hook's `#!` line, where an `exit` or `exec` further down
cannot skip it; what the hooks already do stays. Each model folder of the
repository has a line of its own, a second install adds nothing (or brings
the line up to date when the CLI or node moved), and the line never fails
the git command. A hook written in another language than sh (Python, say)
is left as it is: the command exits 2 and says what to call from it.
It runs the CLI that installed it, with the `node` on the PATH, else the one
that installed it. In this repository `npm run hooks` builds the CLI,
installs the hooks for `architecture/` and saves its base once.

## radical federation

```sh
node apps/cli/dist/index.js federation open|sync|watch path/to/model [--force]
```

One model across many repositories. A model folder names the models it
depends on in `deps.json`:

```json
{
  "name": "payments",
  "dependencies": [
    { "name": "orders", "repo": "git@github.com:acme/orders.git", "path": "architecture", "ref": "v2.3.0" }
  ]
}
```

`repo` is a git address or a path relative to the model folder, `path` the
model folder in that repository, `ref` a branch, tag or commit.

- `open` fetches each dependency at its ref into the cache (`$RADICAL_CACHE`,
  else the user's cache directory; one bare partial clone per repository, so
  only the model files are downloaded) and composes one model folder in
  `.radical/federation/`: the folder's own elements, relations, views and
  metamodel as they are, and every dependency's elements and relations with
  `origin: "<name>@<commit>"`. Studio and the MCP server open that folder;
  they draw elements with an origin dashed and refuse every change to them
  but their place. The composed folder gets a base composed the same way
  (Changes on branch shows only this model's changes), `check.json` and the
  test results. Changes not carried home yet are carried first.
- `sync` writes what has no origin back to the model folder, and names each
  change to an element or relation with an origin, which it keeps out and
  undoes in the composed folder (exit 1). When the model folder changed too,
  nothing is carried unless `--force`; `open --force` composes again from the
  model folder and drops the composed folder's changes.
- `watch` opens, then keeps both in step until stopped (Ctrl-C).

Dependencies are not composed transitively. With a `deps.json`,
`radical check` checks the model composed with its dependencies (see below).

## radical check

```sh
radical check path/to/model
```

Checks one model folder and prints what it finds:

- **the folder**: a valid `radical.md`, JSON sidecars that parse, no git
  conflict markers, node files with an id and a type, no duplicate ids, and
  views, sequences and slides that point at things the model has;
- **the metamodel**: the Validation list Studio shows and `get_issues`
  returns over MCP, with the same severities;
- **completeness**: requirements verified by a scenario, satisfied by an
  element, derived from a need; needs with requirements; accepted ADRs with
  a fitness function and their date, context, decision and consequences;
  fitness functions linked; scenarios and fitness functions that state their
  checks, in conditions that read.

With test reports it also checks that the tests the model names passed, and
with measurements that the values it holds to were met (see below). `radical check --list-rules` lists every rule and every metric a goal can
be set for. It reads the files only and never writes the model.

With a `deps.json` the model is checked composed with the models it names,
at their pinned refs: its relations to their elements hold, one to an element
no model has is the error `rel-end-missing`, and what is found about their own
elements is left to their check. It names the dependencies and commits
(`federation` in the JSON). `--alone` checks the folder without them.

Exit status: 0 no errors (warnings allowed), 1 errors, 2 the check could not
run. `--format json` prints the result as JSON, `--format github` as GitHub
Actions annotations.

### Config

`check.json` in the model folder (or `--config <file>`) sets
rules by id, or one kind of metamodel issue by `metamodel/<code>`:

```json
{
  "rules": {
    "metamodel": "error",
    "adr-incomplete": "off",
    "requirement-without-scenario": { "severity": "error", "max": 104 }
  }
}
```

With `max`, up to that many findings pass as warnings and one more fails the
check, so an existing model can adopt a rule before every gap is closed.
`--ratchet` lowers each `max` to the count found now and writes the config
back; it never raises one. A rule that did not run keeps its `max`: the
`test-*` rules without `--report` (the output marks them `–` and "not run"),
every rule but the folder's when the folder is no model.

### Goals

`goals` sets the least share, in percent, of a metric: requirements with a
scenario, accepted ADRs with a fitness function, and with `--report`
requirements and ADRs verified, scenarios passing, tests the model names, …
(`--list-rules` lists them all):

```json
{
  "goals": {
    "requirements-with-scenario": { "min": 85 },
    "requirements-verified": { "min": 80 }
  }
}
```

A metric below its goal is a finding of `goal-unmet`, an error unless the
config sets that rule (or `goal-unmet/<metric>`) otherwise. A metric of the
test reports counts only with `--report`. Where `max` says how many gaps a
rule may have, a goal says how much of the model must be covered, so it keeps
its meaning as the model grows.

### Tests no scenario names

`test-unbound` lists, per test file, the tests no scenario or fitness function
names. It looks only at the files its `include` matches, so that unit tests of
internals stay out of it; a scenario has to name a test by its title or its
describe block, since a fitness function that names a whole file or directory
(`apps/e2e/tests`) is an umbrella over many behaviours:

```json
{ "rules": { "test-unbound": { "severity": "warning", "include": ["apps/e2e/**"], "exclude": ["**/known-issues.spec.ts"] } } }
```

`--verbose` and the Inspector list the titles of those tests.

### Tests and evidence

A scenario or a fitness function says what checks it in its `metrics`
property, one condition per line. A test that has to pass is named as Vitest
and Playwright print it:

```
test(apps/cli/src/cli.test.ts › radical check › prints the result as JSON) passed
test(apps/e2e/tests/studio/forge.spec.ts › Forge files each stage into its view) passed
test(packages/layout/tests/geometry.test.ts › createBatchPlacer) passed
test(apps/e2e/tests) passed
```

An id names the test whose title it ends, otherwise every test in the
describe block it starts; one without a title names every test in a file or
directory. File paths match by suffix, so absolute paths in a report and
workspace-relative ones in a JUnit file both do.

```sh
npx vitest run --reporter=json --outputFile=reports/unit.json
npx playwright test --reporter=json > reports/e2e.json
radical check model --report reports --evidence evidence.json
```

`--report` takes Vitest or Jest JSON, Playwright JSON and JUnit XML, or a
directory of them (its .json and .xml files), and may be repeated.

In this repository `npm run test:reports` runs every workspace's tests and
leaves a report per workspace in `reports/`, the e2e suite adds
`reports/e2e.json`, and `npm run check:architecture` checks the local
`architecture/` model against them. CI keeps `reports/` as the
`test-reports` artifact (and `reports/e2e.json` in `e2e-report`). A named
test that failed or is gone from the report of its file (renamed, deleted)
is an error; one that was skipped, or whose file no report has, a warning.
The text output sums up how many requirements, scenarios, ADRs and fitness
functions the reports verify. `--evidence` writes that status per element
as JSON (`verified`, `broken`, `unverified` for requirements and ADRs;
`passed`, `failed`, `stale`, `not-run`, `no-checks` for scenarios and
fitness functions, with each condition's outcome); it never writes into the
model.

With `--report` the command also keeps the test cases it read in the model
folder's `.radical/test-results.json` (out of git, like the rest of
`.radical/`). Studio's Inspector perspective reads them and the model's
`check.json`, and runs the same check on the model as it is edited: Model
quality and Implementation show the result by dimension, and Settings edit
`check.json` (goals, severities, baselines), marking a change that loosens
the gate.

### Test results from CI

```sh
radical check path/to/model --from-ci
```

reads the test reports of CI instead of `--report`. Test results never go
into git, since a commit cannot hold the results of its own tests; CI runs
every suite on every pull request and keeps the reports as artifacts. The
command finds, with the GitHub CLI (`gh`, signed in), the nearest commit in
HEAD's first-parent history that a completed GitHub Actions run tested; a
commit merged from a pull request (a squash merge has no run of its own)
stands for the pull request's head. For each artifact it takes the latest
completed run that kept it, downloads it, and reads the `.json` and `.xml`
test reports in it. Which artifacts hold reports is set in `check.json`:

```json
{ "ci": { "artifacts": ["test-reports", "e2e-report"] } }
```

(every artifact of the run without it). The results are kept in
`.radical/test-results.json` with the commit they stand for, the runs, when
each ran and how many commits HEAD is past it, which the Inspector's *Tests*
chip shows; the same runs a second time download nothing. Results read with
`--report` at that commit or a later one are kept, and checked. `--quiet`
prints nothing; `--detach` starts the check in the background and returns,
as the git hooks of `radical hooks install` do after every checkout, commit,
pull and rebase.

### Measured values

A condition can also hold a value to a threshold, which a sensor measures:

```
api.latency.p95{env=staging} <= 300 ms
workspaces.exit_code == 0
```

`<metric>{<labels>} <op> <number> [unit]`, with `< <= > >= == !=`. It is
judged by the latest measurement of the metric whose labels include the
condition's; units of one kind convert (ms and s, KB and MB). The element's
`combine` says how its conditions make its status (`all`, the default;
`any`; `at least N`), and `max_age` (`7d`, `12h`) how old a measurement may
be: an older one is stale, and never passes.

`radical check` reads the measurements kept in the model folder's
`.radical/measurements.json`, and with `--metrics <file|dir>` the
radical-metrics/1 files another job wrote, which it adds there. A condition
that does not hold is an error (`metric-failed`); a stale one
(`metric-stale`) or one nothing measured (`metric-not-measured`) a warning;
a line that reads as no condition, or a unit that does not convert, an error
(`metric-invalid`).

## radical sense

Measures with a sensor adapter and keeps the values beside the model, for
the conditions above. A sensor only measures: it takes no threshold and
exits 0 whatever it measured, 2 when it could not measure.

```sh
radical sense command --name workspaces -- node tools/check-workspaces.mjs
radical sense json k6-summary.json --metric 'api.latency.p95=/metrics/http_req_duration/p(95)@ms' --label env=staging
radical sense json coverage-summary.json --metric 'coverage.lines=total.lines.pct@%' --out reports/metrics/coverage.json
```

- `command [--name <metric>] -- <command…>`: the command's exit code
  (`<metric>.exit_code`) and duration in seconds (`<metric>.duration`).
- `json <file> --metric <metric>=<path>[@<unit>]`: a number from a JSON file,
  by dotted keys with `[index]` or a JSON pointer starting with `/`.
- `--folder <dir>`: the model folder (default: the working directory); the
  values go into its `.radical/measurements.json`, the latest of each metric
  and labels.
- `--out <file>`: a radical-metrics/1 file instead, for `radical check
  --metrics` in another job.
- `--label k=v` labels every measurement (conditions match labels);
  `--context k=v` says where it was measured (a commit, a run).

An adapter for another tool is one module in `src/sensors/` with the
`SensorAdapter` interface, one line in `src/sensors/registry.ts` and a fixture
of its tool's real output; `src/sensors/contract.test.ts` runs every adapter on
its fixture and checks that it writes valid radical-metrics/1 and takes no
threshold. Pull requests welcome.

## radical fuzz

Runs a project's fuzz files (Radical Crucible): tests that do random sequences
of actions to a system and check its rules after every step. `crucible.json`
in the working directory lists them, and the folder findings go to:

```json
{
  "findings": "crucible/findings",
  "fuzz": [{ "file": "packages/ui/tests/invariants.test.ts", "cwd": "packages/ui" }]
}
```

Each file runs with `npx vitest run <file>` in its `cwd`, or with its own
`command` (a list). Paths are from the folder `crucible.json` is in.

```sh
radical fuzz                    # plan ci: each file's fixed seeds and runs
radical fuzz night              # a random seed and 2000 runs of each world
radical fuzz --world bookstore --runs 300 --seed 7
radical fuzz night --survey     # record each new failure as a finding
radical fuzz --replay F-0003    # run a finding again
radical fuzz --report reports   # a Vitest JSON report per file, for radical check
```

`--survey` goes on after each failure and writes each one whose signature (its
rule, its last action and the shape of what differs, with the ids taken out) no
finding has yet as `crucible/findings/F-NNNN.md`, status `open`, with the
world, seed, path and length that replay it, the steps and what differs.
`--no-known` lets the fuzz files' known failures filter nothing, `--no-shrink`
reports the first failure as found.

A fuzz file is written with the engine, `@radical/crucible`, which is not
published yet: so far the fuzz files are this repository's own
(`packages/ui/tests/invariants.test.ts`). It reports a test case per world and
one per world and rule (`on the bookstore model: undoRestores holds`), which a
scenario or a fitness function can name in its Metrics.

Exit status: 0 every file passed, 1 one failed, 2 radical fuzz could not run.

## radical harden

Turns a finding into a test bound to the model (Radical Crucible).

```sh
radical harden F-0003 --scenario "Undo is exact"
radical harden --gate F-0003
radical harden --gate --test "apps/e2e/tests/studio/views.spec.ts › a view keeps its places" --base main --runs 5
```

A fuzz finding is hardened by its own steps: the finding is marked `hardened`,
and its fuzz file replays the shrunk sequence as the test
`<fuzz file> › F-0003 stays fixed: <title>`, once and without the known
failures, so it fails until the bug is fixed. The command prints that test as a
`test(…) passed` line for the scenario's Metrics and keeps the scenario's name
in the finding; it does not change the model's files.

`--gate` checks a test before it is bound: with the source files changed since
the base (default: the merge base with `origin/main`) set back to it, the test
must fail; put back, it must pass; and it must pass `--runs` runs at once
(default 5). Tests, findings and `crucible.json` are not set back, and the
working tree is left as it was (files are copied aside, never stashed), also
when the gate is interrupted: Ctrl+C, `kill` or a closed terminal stops the
test, puts the changed files back and ends with exit status 2. A test
runs through the runner `crucible.json` gives for its folder, else with
`npx vitest run <file> -t <name>` in the file's package:

```json
{ "runners": [{ "files": "apps/e2e/", "cwd": "apps/e2e",
                "command": ["npx", "playwright", "test", "{file}", "-g", "{name}", "--reporter", "line"],
                "build": [["npm", "run", "build:web"], ["npm", "run", "build:hub"]],
                "repeat": ["npx", "playwright", "test", "{file}", "-g", "{name}",
                           "--repeat-each", "{runs}", "--workers", "{runs}", "--reporter", "line"] }] }
```

A runner's `build` (commands run from `crucible.json`'s folder) is made before
the run without the fix and before the run with it, so a test of a build (an
e2e test) runs on what the files are at each step; its `repeat` (with
`{runs}`) makes the runs at once one run of that command, for runs that
cannot go side by side (web servers on fixed ports). `--test` takes the
test's title with its describe blocks (`"<file> › <describe> › <name>"`);
Vitest and Playwright get the parts joined by spaces, as they match them.

Exit status: 0 done (the gate passed), 1 the gate failed, 2 radical harden
could not run or was interrupted.

## radical explore

An exploratory round (Radical Crucible): agents look for bugs no test
describes, each run in its own area. `radical explore` prepares the round and
checks what comes back; a coding agent's session starts the agents.

```sh
radical explore prepare --runs 5 --areas "layout under edits; milestones and undo"
radical explore verify 70 "f1-row.mjs 2" "f2-undo.mjs"
radical explore record .crucible/rounds/round-70-74/run-70/REPORT.md
```

`prepare` builds the project once, copies what the runs need into
`.crucible/rounds/round-<from>-<to>/build`, and gives each run a folder, its
ports (`<ports>+NN`, `+100+NN`, `+200+NN`) and a `PROMPT.md` with its area;
`BRIEF.md` names the commit, the commits and the model elements changed since
the last round (by area), the open findings, the setup, the rules and the
report's JSON form. `--since`, `--from` and `--no-build` change what it
counts from, the first run's number and whether it builds. The brief asks
that scripts name no absolute path (they find the repository by walking up to
`crucible.json`), since a finding's script is copied out of the round.
`verify` serves a run's build on its ports (each server `serve` lists, on the
run's port it names: `app`, `hub` or `other`), runs its scripts from its
folder and stops the servers. `record` writes a report's findings (`open`, or
`question`) with copies of their scripts and of the screenshot each names,
and warns about a copied script that names the repository's or the round's
absolute paths.

```json
{ "explore": {
    "rounds": ".crucible/rounds", "brief": "docs/EXPLORATORY-TESTING.md",
    "known": ["docs/IMPROVEMENTS.md"], "model": "architecture",
    "build": [["npm", "run", "build:web"]],
    "copy": { "renderer": "apps/studio/out/renderer" },
    "serve": [
      { "cwd": "apps/studio", "command": ["npx", "vite", "preview", "--port", "{port}", "--strictPort", "--outDir", "{build}/renderer"] },
      { "cwd": "apps/hub", "command": ["npx", "vite", "preview", "--port", "{hubPort}", "--strictPort", "--outDir", "{build}/hub"], "port": "hub" } ],
    "ports": 4500, "rules": ["…"] } }
```

Exit status: 0 done, 2 radical explore could not run.

## Publishing (maintainers)

The public npm package is `@radicaltools/cli`. Its private `@radical/*`
workspace dependencies are bundled into the build. The package ships only
`dist/`, this README, its manifest and the MIT license.

From the repository root, install dependencies and validate the release:

```sh
npm ci --ignore-scripts
npm run typecheck -w @radicaltools/cli
npm run test -w @radicaltools/cli
npm run test:package -w @radicaltools/cli -- --out-dir ../../release
```

The package check builds and packs the CLI, installs the tarball offline into
a temporary project outside the monorepo, and runs the installed command to
verify its version, help and model checks. Only after validation does it copy
the verified tarball into `release/`. Temporary files are removed afterwards.

Log in with an npm account authorized to publish in the `radicaltools`
organization, then publish the verified first-release tarball:

```sh
npm login --auth-type=web
npm whoami
npm publish ./release/radicaltools-cli-0.2.0.tgz --access public
```

Complete npm's browser and 2FA prompts. When publishing directly from the
workspace, `prepublishOnly` runs the type check, unit tests and package check;
`prepack` builds fresh output and copies the root license. Publishing an
already verified tarball uploads that exact archive. The monorepo root and
the shared workspaces remain private.

The CLI shares one product version with the MCP server, the Desktop app and
the VS Code extension: set it for all of them with `npm run release` (see
*Releasing* in the root README), never in this workspace alone. `radical
--version` prints it, with the commit it was built from unless the build is the
release tagged `v<version>`.

Each package version can be published only once. After the first publish,
the npm organization's team settings can grant the `developers` team
read/write access to `@radicaltools/cli`.

### GitHub Actions with Trusted Publishing

The shared **Publish to npm** workflow (`.github/workflows/npm-publish.yml`)
publishes either CLI or MCP. After `@radicaltools/cli` exists on npm,
open its **Settings → Trusted publishing** and add GitHub Actions:

| Field | Value |
| --- | --- |
| Organization or user | `radicaltools` |
| Repository | `radical.tools` |
| Workflow filename | `npm-publish.yml` |
| Environment name | Leave empty |
| Allowed actions | Enable direct publishing with `npm publish` |

Configure this on each npm package that uses the workflow. If a trusted
publisher points at `cli-publish.yml` or `mcp-publish.yml`, replace it with
one using `npm-publish.yml` after merging this change. No npm token or GitHub
secret is needed. The workflow uses Node 24 and npm 11, with `id-token: write`
for its publish job.
Configure a new publisher when a release is ready: its first successful
publish must happen within two days; a dry run does not validate it.
See [npm's Trusted Publishing instructions](https://docs.npmjs.com/trusted-publishers/).

A release tag `v<version>` (see *Releasing* in the root README) starts the
workflow for the CLI and the MCP server together. It checks that the tagged
commit is on `main` and that the four released packages carry the tag's
version, type-checks and tests the monorepo, installs and checks the CLI
tarball outside the repository, uploads that archive as an artifact, and
publishes the same archive with provenance, on the dist-tag `next` for a
pre-release. A package version can only be published once; a version npm
already has is skipped, so a rerun publishes what is left.

To validate the archive without a release, use **Actions → Publish to npm →
Run workflow**, select `main`, choose **package: cli**, and leave **dry-run**
enabled. With **dry-run** disabled it publishes, but only from `main`.

