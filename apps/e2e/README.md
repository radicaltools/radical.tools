# @radical/e2e

End-to-end regression suite for the web builds of Studio and Hub, written
with [Playwright](https://playwright.dev). It drives the production bundles
(`vite preview` of each app's `out/`), so it checks what gets deployed.

## Running

From the repo root:

```bash
npm run e2e                                   # build Studio + Hub + MCP, run the suite
npm run e2e -w @radical/e2e                   # build MCP, run against the existing web builds
npm run e2e -w @radical/e2e -- -g "undo"      # one test by name
npm run e2e:ui -w @radical/e2e                # Playwright UI mode
npm run e2e:report -w @radical/e2e            # open the last HTML report
```

The first time, install Chromium: `npx playwright install chromium`.

## Benchmark: opening a view

`studio/bench` measures how long a view of a real model takes to open, from
the click until it is drawn and the main thread has been free of long tasks
for 1.5 s. It is skipped unless `BENCH_MODEL` names a Markdown model folder:

```bash
npm run build:web -w radical-model
BENCH_MODEL=$PWD/architecture npm run e2e -w @radical/e2e -- tests/studio/bench.spec.ts --project=studio
```

`BENCH_VIEW` picks the view (default: Structure view), `BENCH_FROM` the view
each run starts from, `BENCH_RUNS` the number of runs, and `BENCH_OUT` a
folder for the samples and a CPU profile of the last run (open it in Chrome
DevTools › Performance; build with `npx vite build --config
vite.web.config.ts --minify false` in `apps/studio` for readable names).

## Benchmark: a large model

`studio/scale` measures what a user waits for on a large model: opening the
folder (and again from its cache with `SCALE_REOPEN=1`), switching views,
zoom and pan, each letter typed in Quick Search and in the card, a pick, a
click and a drag. For each step it reports the long tasks, the frame gaps and
the input delay of each keystroke and click (Event Timing, as INP measures
it). It is skipped unless `SCALE_MODEL` names a Markdown model folder;
`SCALE_COPIES` repeats its elements and relations that many times under fresh
ids (radical.tools' own model ×14 is 21,000 elements and 40,000 relations).

```bash
npm run build:web -w radical-model
SCALE_MODEL=$PWD/architecture SCALE_COPIES=14 SCALE_OUT=/tmp/scale npm run e2e -w @radical/e2e -- tests/studio/scale.spec.ts --project=studio
```

`SCALE_VIEWS` lists the views to open, `SCALE_CANVAS` the canvas for zoom and
clicks, `SCALE_QUERY` what is searched, `SCALE_PROFILE=1` writes a CPU profile
of each step into `SCALE_OUT` (build with `--minify false` for names),
`SCALE_HEAP=1` measures the heap after each view, `SCALE_REOPEN=1` opens the
folder again from the cache Studio wrote (`SCALE_NO_CACHE=1`: with it deleted
first) and `SCALE_ONLY_OPEN=1` stops after opening.

## What it covers

| Spec | |
|---|---|
| `studio/boot` | Welcome screen (New model / Open steps, recent models, the sample), a new empty model, the Models dialog |
| `studio/editing` | Palette drop, rename, Alt-drag connect, forbidden relation, undo/redo, delete, reload |
| `studio/views` | Static, nested, dynamic and table views; sample treemap, matrix, wiki; Viewer and Presenter perspectives |
| `studio/wiki` | Wiki pages read as articles (relations as sentences, children by type, chapters in Multi page), the glossary, the element menu, search by what a page says |
| `studio/layout` | Smart Layout: no overlapping siblings, children inside their parent, same result on every run |
| `studio/presentation` | Playing slides, keyboard navigation, slide deep links |
| `studio/export` | PNG and SVG export produce real files |
| `studio/folders` | Models stored as a folder of Markdown files: move to a folder, new model in a folder, reload, renames that move files, outside edits (including MCP), files Studio must not touch |
| `studio/files` | Models kept in a single `.radical` file: open, edits saved back, reopen after a reload, new model in a file |
| `studio/view-pipeline` | A view's filter as a chain of levels; every view kind shows exactly what it gives |
| `studio/selection-focus` | A selection brings its relations forward; camera and per-view selection |
| `studio/alignment`, `studio/physics`, `studio/edge-labels` | Rows, columns and grids; calm drags, pins and the live physics; edge label placement |
| `studio/matrix`, `studio/markdown`, `studio/need`, `studio/wizard` | Matrix edits; Markdown fields and summaries; needs; node wizards |
| `studio/metamodel-editor`, `studio/metamodel-diagram`, `studio/state-machines` | The metamodel editor, its Diagram tab, statecharts |
| `studio/forge`, `studio/hub-import` | Radical Forge stages; importing from the Hub |
| `studio/inspector` | The Inspector shows what radical check says by tab; its links lead to the element; a deep link opens it; Settings save goals and rules to check.json and flag a change that loosens the gate |
| `studio/known-issues` | Open bugs, marked `test.fail` (see below) |
| `hub/hub` | Landing page, categories, search, concept canvas / wiki / table, `.radical` download |

Every test also fails on an uncaught exception or a `console.error`, and
blocks network requests that leave `localhost`. Hub's requests to
`hub.radical.tools` are answered from this build's `out/hub/`, so the suite
tests the catalogue that is about to be deployed.

Tests start from a known document instead of clicking one together: see
`fixtures/bookstore.radical` and `Studio.seed()` in `support/fixtures.ts`.

Folder tests (`support/folder.ts`) run the web build's File System Access
code against a directory in the browser's origin-private file system: the
directory picker is replaced with one that returns it (`ModelFile` does the
same with the file pickers and one file), and the test edits it
directly to play another editor. They run in a persistent browser profile,
because Chromium crashes when an off-the-record page (Playwright's default)
reads a stored directory handle back from IndexedDB.

## Screenshots

Visual checks use `toHaveScreenshot`. Baselines live in
`tests/**/__screenshots__/` and come **only from Linux**, from the
`mcr.microsoft.com/playwright` image that CI runs in: fonts and anti-aliasing
differ between systems, so a baseline made on macOS would never match CI. On
macOS and Windows the screenshot assertions are skipped and everything else
still runs (`E2E_VISUAL=1` forces them, for local experiments only).

Screenshot tests call `studio.freezeTime()` first. The page clock (timers,
`requestAnimationFrame`) then only moves when the test advances it, so
animations and the live layout render the same frame on every run.

**Updating baselines** happens on its own. On a pull request, CI does not fail
on a screenshot that differs from its baseline: the shard writes the new image,
and once the suite passed, the job *Commit new screenshot baselines* commits the
changed images to the branch (`test(e2e): update screenshot baselines`) and
starts CI by hand on that commit, which compares them strictly. Check the
images in the PR diff before merging: an unintended visual change shows up
there, not as a failed check. Pull before pushing again. Before a deploy from
`main`, a differing screenshot fails the suite.

## Manual screenshots

`playwright.docs.config.ts` and `docs/` are not tests: they take the
screenshots of the manual (`apps/web/screenshots/<name>-light.png` and
`-dark.png`) from the web builds, one `test` per figure. Run
`npm run docs:screenshots` from the root after a UI change (`-- -g wiki` for
one figure), look at the images, and commit them with the manual. Unlike the
suite, they load web fonts and come from macOS. The Inspector figures read the
repository's own `architecture/` model and the test results
`npm run check:architecture` left in `architecture/.radical/`. Two more come
from the same run: README's `screenshots/demo.gif` (a recording of the
sample's views, turned into a GIF by `ffmpeg`, which must be on the PATH) and
`apps/web/social-preview.png`, the repo's social preview and the site's
`og:image`. Upload a new social preview in the GitHub repo's settings too.

## CI

`ci.yml` runs type-check, unit tests and this suite once per pull request into
`main`, on the PR's merge commit. The suite runs in four shards side by side
(`--shard=n/4`, each with a blob report); the *E2E (Playwright)* job merges them with
`playwright.merge.config.ts` into the HTML report and `reports/e2e.json`
(artifact `e2e-report`), and fails when a shard failed. It is the check
`main`'s branch protection requires (*E2E / E2E (Playwright)*), so renaming it
needs the protection updated too. Branches without a PR are not checked
automatically; start CI by hand from the Actions tab (*Run workflow*) if you
need it. A new push to a PR cancels the checks still running for the previous
commit. On `main`, `deploy.yml` runs this suite before every deploy.

**Skipping it on a PR:** add the `skip-e2e` label. The next CI run (the next
push, or *Run workflow*) skips the E2E job; type-check and unit tests still
run. Adding the label does not start a run by itself. Remove the label to get
the suite back; it runs before the deploy from `main` either way.

## Known issues

`tests/studio/known-issues.spec.ts` holds tests for bugs that are not fixed
yet. Each one asserts the correct behaviour and is marked `test.fail`, so it
passes while the bug is there. When a fix lands, Playwright reports "expected
to fail, but passed": delete the `test.fail` line and the test becomes a
regression guard.

## Upgrading Playwright

`@playwright/test` is pinned to an exact version. Bump it together with the
image tag in `.github/workflows/e2e.yml`; the next PR run commits the
regenerated baselines.
