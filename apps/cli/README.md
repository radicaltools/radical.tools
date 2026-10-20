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
the base Studio compares with follows the branch checked out. The line goes
right after the hook's `#!` line, where an `exit` or `exec` further down
cannot skip it; what the hooks already do stays. Each model folder of the
repository has a line of its own, a second install adds nothing (or brings
the line up to date when the CLI or node moved), and the line never fails
the git command. A hook written in another language than sh (Python, say)
is left as it is: the command exits 2 and says what to call from it.
It runs the CLI that installed it, with the `node` on the PATH, else the one
that installed it. In this repository `npm run hooks` builds the CLI,
installs the hooks for `architecture/` and saves its base once.

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

