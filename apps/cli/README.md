# radical CLI

The `radical` command line for Radical Markdown model folders.

## radical diff

```sh
node apps/cli/dist/index.js diff path/to/model [--since <ref>] [--format json]
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

## radical check

```sh
npm run build -w @radicaltools/cli
node apps/cli/dist/index.js check path/to/model
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
  fitness functions linked and with a threshold.

With test reports it also checks that the tests the model names passed (see
below). `radical check --list-rules` lists every rule and every metric a goal can
be set for. It reads the files only and never writes the model.

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
back; it never raises one.

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

A scenario or a fitness function names the tests that run it in its `tests`
property, one per line, as Vitest and Playwright print them:

```
apps/cli/src/cli.test.ts › radical check › prints the result as JSON
apps/e2e/tests/studio/forge.spec.ts › Forge files each stage into its view
packages/layout/tests/geometry.test.ts › createBatchPlacer
apps/e2e/tests
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
`passed`, `failed`, `not-run`, `no-tests` for scenarios and fitness
functions); it never writes into the model.

With `--report` the command also keeps the test cases it read in the model
folder's `.radical/test-results.json` (out of git, like the rest of
`.radical/`). Studio's Inspector perspective reads them and the model's
`check.json`, and runs the same check on the model as it is edited: Model
quality and Implementation show the result by dimension, and Settings edit
`check.json` (goals, severities, baselines), marking a change that loosens
the gate.

