# @radical/e2e

End-to-end regression suite for the web builds of Studio and Hub, written
with [Playwright](https://playwright.dev). It drives the production bundles
(`vite preview` of each app's `out/`), so it checks what gets deployed.

## Running

From the repo root:

```bash
npm run e2e                                   # build Studio + Hub, run the suite
npm run e2e -w @radical/e2e                   # run it against the existing builds
npm run e2e -w @radical/e2e -- -g "undo"      # one test by name
npm run e2e:ui -w @radical/e2e                # Playwright UI mode
npm run e2e:report -w @radical/e2e            # open the last HTML report
```

The first time, install Chromium: `npx playwright install chromium`.

## What it covers

| Spec | |
|---|---|
| `studio/boot` | Welcome screen, the Fintech sample, a new empty model |
| `studio/editing` | Palette drop, rename, Alt-drag connect, forbidden relation, undo/redo, delete, reload |
| `studio/views` | Static, nested, dynamic and table views; sample treemap, matrix, wiki; Viewer and Presenter perspectives |
| `studio/layout` | Smart Layout: no overlapping siblings, children inside their parent, same result on every run |
| `studio/presentation` | Playing slides, keyboard navigation, slide deep links |
| `studio/export` | PNG and SVG export produce real files |
| `studio/folders` | Models stored as a folder of Markdown files: save as folder, reload, renames that move files, edits made outside Studio, files Studio must not touch |
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
directory picker is replaced with one that returns it, and the test edits it
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

**Updating baselines** after an intended visual change: add the
`update-screenshots` label to the PR. The `E2E — update screenshots` workflow
regenerates the baselines that changed, commits them to the branch and removes
the label. Check the images in the PR diff, then re-run the CI checks (a bot
push does not start them).

## Known issues

`tests/studio/known-issues.spec.ts` holds tests for bugs that are not fixed
yet. Each one asserts the correct behaviour and is marked `test.fail`, so it
passes while the bug is there. When a fix lands, Playwright reports "expected
to fail, but passed": delete the `test.fail` line and the test becomes a
regression guard.

## Upgrading Playwright

`@playwright/test` is pinned to an exact version. Bump it together with the
image tag in `.github/workflows/e2e.yml` and `e2e-update-screenshots.yml`,
then regenerate the baselines.
