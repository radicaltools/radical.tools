# Exploratory testing

A brief for an agent that looks for bugs **no test describes yet**. The unit
and e2e suites check what somebody thought of; this is for the rest. It is
not a list of scenarios: a scenario somebody wrote down belongs in the
suites. It says how to tell that something is wrong, where to look, and what
to hand back.

The maintainer edits this file when a run reports something that is not a
bug, or misses a kind that it should have caught.

## What a finding is

Something a user of Studio, Hub or the MCP server would call broken, that
you reproduced **twice from a fresh page**, and that is not already known.

Not a finding:

- anything in `docs/IMPROVEMENTS.md` (earlier runs are under "Found by
  exploratory runs") or in `apps/e2e/tests/studio/known-issues.spec.ts`.
  The repository has no GitHub issues;
- a matter of taste (a layout you would have drawn differently, wording);
- something you saw once and could not make happen again: note it under
  "Seen once" in the report, in one line, and move on;
- behaviour the manual (`apps/web/manual.html`) describes as intended.

## How to tell that something is wrong

These hold whatever you did before. Any sequence of actions that breaks one
is a finding. They are deliberately general: do not turn them into a fixed
script.

1. **A reload changes nothing.** What the canvas shows after a reload is
   what it showed before: positions, sizes, which containers are open, the
   active view, the camera. The same after closing and reopening a model,
   and after switching to another view and back.
2. **Nothing moves by itself.** With no input, elements stay where they
   are and the saved document does not change. An element moves only when
   the user moved it, added something next to it, expanded something, or
   ran a layout. A collapse moves nothing: the container shrinks where it
   stands. How far an add or an expand may reach is
   not settled: up to 40 elements by relation and containment may move, so
   on a small view that can be all of them. Report it only when elements
   with no relation or container in common with the new one move.
3. **Undo is exact.** Undo after any action gives back the document as it
   was, positions included; redo gives the action back. A chain of undos
   returns to the start. The camera is not part of undo. A drag is one
   step: the elements it moved or pushed go back and its pins come off.
   Undo goes back to the canvas the step was made on. A milestone has its
   own steps, and opening one is none. Undo belongs to Designer: in
   Viewer and Presenter, and while a text field has the focus, it must
   not take one of Designer's steps. Adding, renaming and deleting a
   view or a sequence, and each edit of a sequence, are steps. A step
   that holds elements of a type deleted since is gone.
4. **Geometry.** Siblings do not overlap. A child is inside its parent,
   on every canvas, also one it was not added on. No element sits far
   from all the others without the user having put it there. After Smart Layout: running it again reports that the current
   layout already scores best, and the same diagram gets the same layout.
5. **Canvases are separate.** A layout, alignment, pin or collapse made in
   one view does not change another view or All elements.
6. **The file is the model.** Saving to a `.radical` file or a folder and
   opening it again gives the same model and the same picture. So do
   export and import. Studio writes only the files that changed.
7. **Perspectives do not edit.** Whatever is dragged, collapsed or laid
   out in Viewer or Presenter, the saved document stays as it was. Only
   the slides managed in Presenter are saved, and nothing else with them.
   Back in Designer, the canvas, the milestone shown and the undo steps
   are what they were when it was left.
8. **The metamodel is kept.** Studio does not let the user build what its
   own validation then flags, and a refused action says why. The MCP
   server refuses the same things Studio does.
9. **Agents and people see the same model.** An edit through the MCP
   server shows in an open Studio as the tool reported it; `get_issues`
   lists what Studio's validation lists; `smart_layout` gives the layout
   Studio's Smart Layout gives on the same model.
10. **No errors.** No uncaught exception, no `console.error`, no request
    that leaves `localhost`, no control that does nothing when clicked.
11. **The manual is true.** Each sentence of `apps/web/manual.html` that
    says what happens is a claim you can check.

## Where to look

Spend most of the run where bugs are likely, not where it is easy:

- **What changed.** Read `git log` since the last run ("Found by
  exploratory runs" in `docs/IMPROVEMENTS.md` says which commit it
  tested). Test each
  change **next to its neighbours**, not alone: its tests already cover it
  alone. A layout change next to alignments, pins, collapsed containers,
  views, milestones, undo. A file-format change next to folders, outside
  edits, the MCP server.
- **Combinations.** Most bugs found so far needed two features at once (a
  relation to an expanded container and the live physics; a drop onto a
  pinned element; a view switch during a layout). Pick two or three
  features that have no test together and use them together.
- **Order and timing.** The same actions in another order; an action
  while another is still running (a reload right after Smart Layout, a
  drag while the physics settles, a view switch during a save). Smart
  Layout on the sample's All elements takes about three seconds, long
  enough to act during it; on the small fixtures it is over at once.
- **Sizes.** An empty model, one element, a model near 150 drawn leaves
  (from there up a ⌘/Ctrl drag frees only the held element's surroundings,
  and Smart Layout does not try the physics' relaxation), several hundred.
- **Different models.** The sample (Open → Sample model),
  `apps/e2e/fixtures/*.radical`, and the Hub blueprints in
  `packages/hub-catalogue/catalogue`. Models with state machines, domains,
  mockups and many root elements behave unlike plain C4 ones.

Do not walk the same path twice in a row. Each run, choose differently.

## How to drive the product

- Build once: `npm ci`, `npm run build:web`, `npm run build -w
  @radicaltools/mcp`, `npx playwright install chromium`. Serve Studio from
  `apps/studio` with
  `npx vite preview --config vite.web.config.ts --port <port> --strictPort`.
  When the checkout is shared (several runs at once, or someone fixing
  while you test), copy `apps/studio/out/renderer` into your scratch
  directory first and serve the copy (`--outDir <copy>`): a rebuild of the
  shared output in the middle of a run gives white pages after a reload
  and a Smart Layout worker that fails to load, which are not findings.
  Say in the report which build you tested (commit, or the time of the copy).
- Note the window size your scripts use (the e2e suite runs at 1280×720):
  what is off screen there is scrolled to, and a scrolled page can hide
  a jump that a taller window shows.
- Drive it with Playwright scripts you write in a scratch directory
  outside the repo. `apps/e2e/support/fixtures.ts` shows how: a document is
  seeded into `localStorage` before the app loads (`radical-docs-index`,
  `radical-doc:<id>`), and a deep link opens it:
  `/#/d/ls:<id>/m/<designer|viewer|presenter|metamodel>/v/<viewId|canvas>`.
- Read state from two places and compare them: the canvas (each
  `.react-flow__node` has `data-id` and a `transform`; a child's transform
  is absolute, the document keeps it relative to its parent) and the saved
  document in `localStorage`. A difference between the two is often the
  bug. In the document, each view keeps its own positions in
  `views[].positions[id]` and All elements in `defaultPositions`;
  `nodes[].x/y` only mirror the canvas that was active at the last save.
  Compare positions, not sizes: some elements are drawn smaller than the
  size stored (a known item under "Alignments").
- Switch views as a user does: the "Views" header in the left panel, then
  a view card (`.lp-view-card`). The left panel is an accordion: the cards
  of a closed section are in the page but out of reach under another
  section's header, so click the section's header first (the same for
  milestones, `.lp-snap-card`). The sample gets a new document id each
  time it is opened; read it from the address.
- The first edit in a milestone opens a prompt whose backdrop covers the
  left panel: answer it before clicking a view or milestone card.
  "Current (live)" discards the milestone's edits without asking.
- Compare a document against one Studio has already saved, not against
  the fixture: the first save adds `defaultPositions`, `defaultViewport`,
  the metamodel and a presentation.
- The Hub is served from `apps/hub` with
  `npx vite preview --port <port> --strictPort`. Its requests to
  `hub.radical.tools`, and Studio's, are answered locally as
  `apps/e2e/tests/hub` does.
- A flow (dynamic) view has no `.react-flow__viewport`: a helper that
  waits for the canvas to be still must not wait on it there.
- Smart Layout's notice may still be on screen from the run before. Tell
  two runs apart by the app's `[smartLayout]` line in the console, or by
  counting what moved, not by the notice.
- Folder-backed models: `apps/e2e/support/folder.ts` gives the web build a
  directory in the browser's own file system, in a persistent profile, and
  the test "an MCP model edit appears in the open browser canvas" in
  `apps/e2e/tests/studio/folders.spec.ts` shows how to let the MCP server
  write to the same folder. After a reload brought in by an outside
  edit, removed relations stay drawn as dashed lines for a few seconds:
  count from the search bar ("N nodes · M relations"), not the edges.
  The MCP server does not start on a folder with malformed JSON, and
  Studio names the file and saves nothing until it reads again.
- Each MCP write marks `.radical/agent-activity.json`, and Studio holds
  its own saves for 15 s after it ("An agent is editing this model").
  Wait it out before reading Studio's save from the folder, and do not
  carry a fresh mark into a new page. Writing the mark by hand stands in
  for an agent when no server is needed.
- Run as a subagent, a run may not be allowed to write a report file:
  then the report is its final message.
- The toolbar's Undo and Redo are covered by the search bar at 1440 px (a
  known issue): use the keyboard or a wider window. In headless Chromium
  on macOS, Meta+Z does not reach Studio's undo: press Control+Z.
- Use the real controls (buttons by their accessible name, mouse drags),
  as a user would. Reaching into the store proves nothing about the
  product. Type with real keys (`keyboard.type`, `pressSequentially`):
  `fill` sets a value in one go and `selectOption` fires a change for
  the option already shown, and each has hidden a bug.
- Shortcuts follow the platform: Quick Search is ⌘P on macOS and Ctrl+P
  elsewhere, on every view. F5 starts the presentation.
- With no route in the address Studio opens a model in Viewer, so does
  the Hub's Open in Studio link (`?hub=…`). A deep link names the
  perspective; e2e tests switch with `studio.designer()`.
- After an add, the save comes only when the physics is still, seconds
  later: wait for the change you expect in the saved document, not for
  the document to stop changing.
- The sample's four milestones have 11, 17, 30 and 65 elements, which
  tells the models apart at a glance. "Milestone properties" (on a
  milestone card, on hover) has Rename, Restore to live and Delete.
- Delete in the wiki asks through `window.confirm`; the delete prompt on
  the canvas is a `.milestone-modal`, not a dialog.
- Drive the MCP server as `apps/mcp/scripts/test-package.mjs` does: a stdio
  client against `apps/mcp/dist/index.js --folder <a temp folder>`.
- Take a screenshot when something looks wrong; it goes into the report.
- When many runs share one machine (twenty did at once), keep one browser
  open at a time, close it when a script ends, and do not run the e2e
  suite: it uses fixed ports and a server of its own.
- If `git status` in the repository shows changes you did not make, say so
  in the report and leave them as they are.

Do not change the repository, do not touch model folders outside your
scratch directory, and do not send anything outside `localhost`.

## What to hand back

Stop at three findings that hold, or after a serious try at five
different combinations or areas, whichever comes first (a run asked to
cover named areas covers them and reports what it finds). At most two
findings from one area: a third is worth less than a first look somewhere
no run has been (each run lists what it did not cover).

One report per run, as a pull request that adds the findings to "Found by
exploratory runs" in `docs/IMPROVEMENTS.md` and, for each, a `test.fail`
test to `apps/e2e/tests/studio/known-issues.spec.ts` (the suite stays green
while the bug is there and turns red once it is fixed). For each finding:

- **Title**: what is wrong, as the user would say it.
- **Rule**: which of the eleven above it breaks.
- **Steps**: the shortest sequence that shows it, from a named model, and
  the script that runs it.
- **Expected / actual**, with numbers where there are any (positions,
  counts) and a screenshot.
- **How often**: every time, or how many of how many tries.
- **Where it probably comes from**, if you looked: file and function. Mark
  a guess as a guess.
- **A test that would have caught it**: where it belongs (`packages/*/tests`
  or `apps/e2e/tests`) and what it asserts, in a few lines. A finding is
  finished when that test exists; then the suites cover it and the next
  run looks elsewhere.

End the report with: the commit tested, what you covered and what you did
not get to, and "Seen once".

A run that finds nothing says what it tried. Do not pad the report: three
findings that hold are worth more than ten that might.
