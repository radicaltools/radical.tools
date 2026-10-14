# radical.diagram — Improvement proposals

Two layers of suggestions: **functional** (what the user sees / can do) and **technical** (code quality / structure). Generated 2026-04-28.

---

## Part 1 — Functional improvements

### Modelling (Designer)

1. **Undo/redo** — must-have. Every move/delete is currently irreversible (milestones are too heavy for this).
2. **Multi-selection & group operations** — select N nodes → move together, delete together, "wrap into a new system/container".
3. **Quick search / jump (Cmd+P)** — find "Payment Service" in a model with dozens of nodes; pan camera to it.
4. **Duplicate node + subtree** — Cmd+D for whole subsystems ("clone microservice template").
5. **C4 model validation** — components without a container, cross-system relations without description, cycles. "Issues" panel with click-to-fix.
6. **Auto-save vs. dirty indicator** — Toolbar should show unsaved-changes state; warn on close.
7. **Export** — PNG / SVG / PDF of the whole diagram or current view.
8. **Import** — PlantUML / Structurizr DSL / Mermaid for onboarding.

### Views

9. **Auto-views per element** — "show everything related to this system" in one click (system + its containers + direct neighbours).
10. **View remembers layout too** — currently a view stores only `nodeIds`. Persist positions/zoom so each view ("Container View") has its own readable layout independent of "System Context".
11. **Auto-generated C4 view hierarchy** — System Context, Container, Component (per container) generated automatically rather than hand-built.
12. **Tag filtering** — add `tags?: string[]` to nodes (e.g. `legacy`, `external`, `pci-scope`); view = "everything tagged X".

### Relations

13. **Richer relation labels** — protocol (HTTPS/gRPC/Kafka), data direction, sync/async; today only `description`.
14. **Auto-routing around labels** — arrows sometimes cross neighbouring labels.
    Labels now avoid nodes, other labels and other edges (`@radical/layout/edgeLabels`),
    hide when the zoom makes them unreadable, and Smart Layout leaves room for them
    between neighbours (`labelRoom.ts`, `labelCrowding` in the score). Left: routes
    still ignore labels; the room costs ~14% more crossings on the large blueprints
    (110 → 125 over 5 seeds) — worth trying label sizes on ELK edges
    (`elk.edgeLabels.placement`) so candidates plan the room instead of finalizeLayout
    pushing it in, measured with `labelOverlaps` and crossings over several seeds.
15. **Bundling parallel relations** — when A↔B has 3 relations, render them as a visual "bundle".

### Milestones (architecture over time)

16. **Side-by-side diff view** — what changed between v3 and v5: added/removed/changed nodes, highlighted on canvas.
17. **Auto-milestone** — every X edits or "milestone on save" so the user does not need to remember.
18. **Notes / changelog per milestone** — "what changed and why" field.
19. **Branching milestones** — experimental architecture variant as a "branch" off v3, with optional merge.

Added in `feat/mcp-milestones`: the AI tools (Studio's chat and the MCP
server) list, save, rename, delete and compare milestones, and a slide can
show one. Still open:

- **The agent cannot look inside a milestone.** `search_model` reads only the
  current model; `compare_milestones` is the only view of a milestone's content.
- **The agent cannot change a milestone or load one.** Studio's edit workflow
  (propagate to later milestones, or insert a new one) has no tool, and
  loading one over the current model is left to the timeline on purpose.

### Presenter / Viewer

20. **Presenter notes** — per slide, visible only to presenter.
21. **Smooth transitions** — pan/zoom interpolation between viewports instead of cuts.
22. **Spotlight per slide** — "highlight these 3 nodes on this slide", others dimmed.
23. **Slide annotations** — arrows, circles, text drawn on an overlay layer without changing the model.
24. **Export presentation** — PDF / PPTX (one slide per page).
25. **Publish / share link** — read-only viewer in a browser without Electron.
26. **Reorder slides** — drag-and-drop in the new bottom dock (verify if working).

### Layout

27. **Pin / lock node position** — "this node stays put, the rest can re-flow".
28. **Compact / spread toggle** — global "layout density" slider.
29. **Snap-to-grid + guides** — for manual dragging (already on the technical pending list).
30. **Layout per view** — different views, different algorithms / parameters.

### General UX

31. **Keyboard shortcuts + cheatsheet** — `?` shows the list. F5 alone is too little.
32. **Mini-map** (if not present) — large models require it.
33. **Zoom-to-fit, zoom-to-selection** — toolbar buttons.
34. **Dark mode** — often required for presentations.
35. **Templates / starter library** — "Microservices template", "3-tier web app" for quick start.
36. **Git-friendly model format** — deterministic JSON sort so model PRs are reviewable.
37. **Comments / discussions** — pinned to nodes/relations (Figma-style). Only meaningful if multi-user is planned.

### Top 5 by value/effort

1. **Undo/redo** (#1) — modelling stops being stressful.
2. **Export PNG/SVG** (#7) — first question every new user asks.
3. **Quick search Cmd+P** (#3) — instant boost past ~20 nodes.
4. **Presenter notes + spotlight** (#20, #22) — turns this into a real architecture-presentation tool.
5. **C4 model validation** (#5) — separates a "drawing tool" from a "design tool".

---

## Part 2 — Technical / code-quality improvements

Status as of 2026-09-29, after the monorepo restructuring (branch
`refactor/monorepo-workspaces`). Paths are relative to the repo root.

### Done

- **Dead components and CSS removed.** Sidebar, ViewBar, PropertiesPanel,
  TimeTravelBar, ExportMenu, DevSampleToolbar and PresentationBar's SlidesColumn
  are gone, along with 182 CSS rules for UI that no longer exists.
- **CSS split by owner.** `packages/ui/src/index.css` holds the shared canvas,
  panel and view styles; `apps/studio/src/renderer/src/studio.css` holds
  Studio-only UI.
- **Side effects out of store actions, partly.** The model rules and edits
  behind node, relation and view changes live in `packages/common/src/model.ts`
  and are shared with a headless facade. Persistence moved out of the store
  into `apps/studio/src/renderer/src/persistence/`.
- **Store tests.** The diagram-store tests live in `packages/ui/tests` and run
  without any app's persistence.

### Still open

1. **Split `diagramStore.ts`** (`packages/ui/src/store/diagramStore.ts`,
   4383 lines) into zustand slices: model, views, layout, snapshots,
   presentation, and ReactFlow derivation. The public API stays identical.
2. **Replace `(window as any).__rf*` globals** (13 in the store) with a typed
   canvas API or React context. This removes most of the store's 155
   `as any` casts and makes the canvas plumbing testable.
3. **Extract hooks from `Canvas.tsx`** (`packages/ui/src/components/Canvas.tsx`,
   1021 lines): `useCanvasDnD`, `useViewportCapture`, `useCanvasKeyboard`.
4. **Split `RightPanel.tsx`** (2185 lines). It exports both `LeftPanel` and
   `RightPanel`. Memoise the tree: `TreeNodeItem` runs several store
   selectors per node.
5. **Consolidate icons.** PresentationBar, Toolbar and RightPanel each define
   their own SVG icon set.
6. **Persistence robustness.** Schema-validate documents on load in
   `apps/studio/src/renderer/src/store/documentStore.ts`.
7. **Stricter `tsconfig`**: `noUncheckedIndexedAccess`,
   `exactOptionalPropertyTypes`. Type-check the tests that `apps/studio` and
   `apps/hub` still leave out.

### Bugs found by the e2e suite (2026-09-29)

Each has a `test.fail` test in `apps/e2e/tests/studio/known-issues.spec.ts`
that turns red once the bug is fixed.

1. **Live layout never settles in views with nested elements.** The live
   WebCoLa layout (`packages/ui/src/layout/liveColaLayout.ts`) keeps ticking
   when group constraints and link forces disagree, so nodes drift (80–320 px
   in 10 s on the bookstore fixture; also the Fintech sample's Core Banking,
   Payments and "All elements" views, and Hub concept canvases). There is no
   iteration cap or movement threshold in live mode.
2. **Autosave starves while that happens.** Every tick replaces `c4Nodes`, which
   restarts the 400 ms debounce in
   `apps/studio/src/renderer/src/persistence/autosave.ts`, so edits reach
   localStorage only on `pagehide`, together with the drifted positions.
3. **Double-click on the empty canvas does not add a system.** React Flow's
   `zoomOnDoubleClick` (default on) swallows the event before
   `Canvas.onCanvasDoubleClick` sees it.
4. **The Quick Search bar covers Undo/Redo** in the toolbar on canvas views at
   1440 px width.
5. **Hub's local catalogue fallback fails for concepts.** When
   `hub.radical.tools` is unreachable, `fetchJson` in
   `packages/ui/src/store/hubStore.ts` falls back to `/hub/`, but rejects the
   `.radical` files that `vite preview` serves as `application/octet-stream`,
   so a concept deep link lands on the catalogue instead.
6. **Property labels are not tied to their inputs** in `RightPanel.tsx`
   (`<label>` without `htmlFor`), so the fields have no accessible name.

### Markdown-folder persistence (review 2026-09-30)

Fixed in `fix/md-folder-persistence`: lost descriptions after a rename, pruning
files the format doesn't own, overlapping saves, loads landing in another
document, and following outside edits (`packages/common/src/formats/mdFolderSync.ts`).
Still open:

1. **Opening a folder rewrites it.** `loadDiagram` changes the store, so
   autosave writes 400 ms after every load, normalising hand-formatted files;
   so does selecting a node (its body hydrates). Ignore load- and
   hydration-driven store changes in `autosave.ts`.
2. **No atomic writes, no flush on quit.** A file cut short by closing the
   window loses its element (no `id` in the frontmatter). Write to a temp file
   and rename; hold the Electron window's `close` until the last save lands.
3. **Save failures are silent** (`console.warn` only), including a save refused
   because the folder changed on disk. Show save state in the toolbar.
4. **Disk wins without merging.** An in-app edit that has not been saved when
   an outside edit arrives is dropped by the reload. A per-element three-way
   merge (base / app / disk, keyed by element id) would keep both.
5. **Frontmatter parser is minimal**: keys outside `[A-Za-z0-9_-]` are
   dropped, `'single quotes'` are kept, `1e5` stays a string, a trailing
   newline in a `|` block is lost. Use the `yaml` package for reading.
6. **Duplicate ids** (a copied `.md` file) are not detected; `version` in
   `radical.md` is never checked; `slugify` can produce names Windows refuses
   (`con`, `nul`, `aux`, `com1`, …); an element in a directory without
   `_index.md` becomes a root element instead of joining the nearest ancestor.
7. **Empty directories stay** after a container is renamed or deleted.
8. **Undoing the deletion of an element never opened** brings it back without
   its description: the file is pruned by the save that followed the delete.
9. **A folder- or file-backed model reloads onto the full canvas**: the async
   load's `loadDiagram` resets the view a deep link (`/v/<view>`) selected.
10. **`file:read` / `file:write` IPC take any path** from the renderer (folder
    writes are confined to the model folder).
11. **Incognito:** Chromium crashes when an off-the-record page reads a stored
    directory handle from IndexedDB (seen with OPFS handles in the e2e suite,
    which therefore uses a persistent profile). Check whether Chrome Incognito
    users of folder mode hit it with real picker handles.

### Node wizards (2026-10-01)

Added in `feat/node-wizard`: `NodeTypeDef.wizard` (metamodel data), wizards for
ADR, fitness function, requirement, scenario and mockup, and
`requestCreateNode` in the store so the canvas, table and wiki all open them
(`packages/ui/src/components/NodeWizard.tsx`). Still open:

1. **No editor for wizards.** The metamodel editor can't define or change a
   type's wizard; a custom type gets one only through the metamodel JSON. Add
   a "Wizard" section: trigger, steps, the fields of each step, help text.
2. **The wizard for an existing element is hard to find.** It opens only from
   "Fill in with wizard…" in the properties panel. Add it to the selection
   action bar and to Wiki pages.
3. **A palette drop on the canvas names the element after its type id**
   ("Adr", "Fitness-fn"); the table and wiki use the metamodel label. Using
   the label on the canvas changes C4 names too ("System" → "Software
   System", which `editing.spec.ts` checks).
4. **Superseding doesn't update the superseded ADR.** Linking `supersedes` in
   the wizard could set the older ADR's status to `superseded`. ADRs also
   have no numbering (ADR-007).
5. **Fields have no per-field hint.** Guidance is per step, so steps with
   several fields share one help text. A `PropertyDef.placeholder` would let
   the properties panel show the same prompts.

### AI tool catalogue and MCP server (2026-10-05)

One catalogue in `packages/common/src/ai/tools` serves Studio's AI
(QuickSearch chat, Radical Forge) and `apps/mcp`: nodes (including
`move_node`), relations, views (`update_view`, dynamic views), sequences,
presentations, the metamodel and `smart_layout` (All elements or one view).
Forge leaves out the metamodel and presentation groups
(`excludeToolGroups`). The facade decides how a tool lands: Studio's store or
the headless model, which the MCP server writes to the folder. Editing a
built-in metamodel (in the Metamodel Editor or through a tool) now works on a
`…-custom` copy, because `documentMetamodel` swaps a preset id back to the
preset on load. Still open:

1. **Studio's smart_layout switches the active view.** Studio lays out what
   is on screen, so the tool first activates the requested view (or All
   elements). The facade's `runLayout` is not covered by a test, because Smart
   Layout needs ELK, which the Studio unit tests don't run.
2. **No wizard editing through the tools.** `upsert_node_type` sets look, containment,
   cardinality, table tab and properties, not `wizard` or
   `hierarchyRelation`.
3. **Slides are framed by fit.** Tool-made slides have no captured viewport or
   canvas state, so Studio fits the slide's view, or the slide's `focus`
   elements (`focusNodeIds`), so several slides can zoom onto parts of one
   view. The exact camera is captured only in Studio, and Studio's slide panel
   neither shows nor edits a focus yet ("Capture viewport" overrides it).
4. **Polish characters in folder slugs.** `slugify` in
   `packages/common/src/formats/mdFolder.ts` turns "zamówienie" into
   "zamo-wienie" (NFKD leaves the accent as a separate mark, which becomes a
   dash). Check whether fixing it renames files in existing folders.

### Metamodel diagram (2026-10-06)

Added in `feat/metamodel-diagram`: a Diagram tab in the metamodel editor
(`apps/studio/src/renderer/src/components/metamodel/`). Node types are boxes
in a frame per palette category (`NODE_TYPE_CATEGORIES`, now shared with the
Elements palette), containment and relation types are edges, placed by Smart
Layout and then settled by the live WebCoLa physics, as on the canvas. Still
open:

1. **No dragging.** The canvas lets you drag nodes while the physics runs;
   the diagram does not. `LiveColaLayout.drag` takes positions relative to
   the cola group bounds, while the diagram keeps absolute ones.
2. **The physics has a time budget (4 s).** WebCoLa does not always converge
   with nested groups (`known-issues.spec.ts`), so the diagram stops it
   instead of waiting for convergence.
3. **Blueprint has no relation type.** In the Governance preset it can only
   be placed inside a Domain or Group; nothing relates it to systems, ADRs
   or requirements.
4. **Dense presets stay dense.** With every edge shown, Governance has ~96
   edges over 16 types; the legend filters and selection focus are the way
   to read it.

### Dogfooding (2026-10-06)

`architecture/` now holds the model of radical.tools itself, built through the
MCP server and exposed to Claude Code in `.mcp.json`. Found while setting it up:

1. ~~**The MCP server cannot start a model.**~~ Fixed in #119: an empty or
   missing folder becomes a new model.
2. ~~**No way to pick a metamodel for a new folder.**~~ Fixed in #119:
   `--metamodel c4|c4-ddd|governance` (default `governance`); since the two
   built-in metamodels, `radical|c4` (default `radical`).
3. ~~**`--folder` must be absolute.**~~ Fixed in #119: a relative path resolves
   against the working directory, so `.mcp.json` calls `node` directly.
4. ~~**Webapps and containers are stored differently.**~~ Fixed with 8: a web
   app is a directory (`studio/_index.md`) like a container, with or without
   components; an old flat file still loads.
5. ~~**Components could not talk to external systems.**~~ The C4 preset had
   no `component → system`, `system → component` or `person → component` pair
   for `interacts`, so a component diagram could not show an AI component
   calling the AI providers, or a coding agent calling the MCP server's stdio
   component. The three pairs are added to `presets/c4.ts`, which all
   three presets share.
6. **`create_view` requires a `tempId`** even when no later call refers to
   the view; five calls failed on it. It should be optional, as it is on
   `add_node`.
7. ~~**Smart Layout traded crossings for the composite score**~~ on
   "Components: Studio" (15 → 18). The cause was 8; after the fix it goes
   18 → 10 with every component inside Studio.
8. ~~**A web app could hold components but behaved as a leaf.**~~ The
   metamodel lets a component sit in a web app, but `CONTAINER_TYPES` left
   `webapp` out and the live physics grouped only `container`: the web app
   never grew around its components, could not collapse, was dropped from the
   WebCoLa simulation, and its components could be dragged out of it. Now a
   web app is a container type (fit, collapse, layout padding, folder format),
   draws as a dashed frame when expanded, and the physics groups every parent
   that cannot nest (container, web app, blueprint).
9. **Adding one node to a view means resending the whole view.**
   `set_view_nodes` only replaces the node set, so putting two new external
   systems on "System context" and "Containers" took a `GET VIEW` per view
   and a full id list back. An `add_to_view` / `remove_from_view` pair (or a
   `viewIds` argument on `add_node`) would make it one call and remove the
   risk of dropping a node by accident.
10. **No check that the model still matches the code.** A review against the
   repo (2026-10-06) found 11 drifts: missing "bundled into" edges that the
   workspace imports prove, an ADR that contradicted `APP_TO_APP` in
   `tools/check-workspaces.mjs`, a stale path in a fitness function, and
   external services (VS Code Marketplace, Google Fonts) missing. A fitness
   function that compares package-to-app edges with the `@radical/*`
   dependencies in every `package.json` would catch the first kind
   automatically.
11. **No MCP tool collapses or expands nodes.** `update_node` and
   `update_view` take no `collapsed`, `collapsedNodeIds` or `expandedNodeIds`,
   and the catalogue has no collapse tool, so collapsing every parent on the
   Structure view meant editing `_layout.json` by hand. It also showed that a
   model-level collapse leaks into every named view: each view that shows a
   collapsed parent's children needed that parent in `expandedNodeIds` in
   `views.json` to stay as it was. A `set_collapsed` tool (ids, collapsed,
   optional viewId) should write the Structure view's state without changing
   the named views.
12. **`move_node` drops a node outside its new parent, and Smart Layout keeps
   it there.** Moving 36 root elements into four new layer groups kept their
   old canvas coordinates as parent-relative ones (Shared packages landed at
   x = −4233 inside a 520 px wide group), and the parents were not refitted.
   `smart_layout` on All elements then answered "the current layout already
   scores best" (`keptCurrent`): the composite score does not penalise a
   child outside its parent's frame. Resetting the moved nodes to 0,0 made it
   lay out again (crossings 570 → 117). Two fixes: `move_node` should place
   the node inside the new parent and refit it, and the layout score should
   count out-of-frame children as overlaps.
13. **Moves and renames leave empty folders behind.** After `move_node` and a
   label change on a folder node, the old directories (`nodes/github/`,
   `nodes/requirements-views/`, …) stayed on disk empty; a later reader that
   expects `_index.md` in every directory fails. `MdFolderSession` should
   remove directories it emptied.
14. **Views pull in every ancestor.** `computeViewNodeSet` adds all ancestors
   of a listed node, so wrapping the model in top-level groups puts a group
   frame into every named view, and a model-level collapse of an ancestor
   that the view never listed hides the view's nodes (see 11). A view should
   be able to start at a chosen level, or skip pure grouping ancestors.
15. ~~**The live physics ignored a view's own collapse overrides.**~~ Fixed:
   `startLiveLayout` built its graph with `filterForView` and the derived
   collapsed set only, without the view's `expandedNodeIds` and
   `collapsedNodeIds`. A node collapsed on All elements but expanded in a view
   (radical.tools in every "Components:" view) was a leaf for WebCoLa, so the
   frames around it shrank to the collapsed box and its parent (the layer
   group) no longer enclosed it. The physics now takes `layoutInputForView`,
   the input Smart Layout and the canvas use, which also leaves hidden
   relations out of the simulation. Found by loading `architecture/` into the
   web build with Playwright and running `layoutViolations` on every view.
16. **No way to check a model's views for layout faults.** The e2e helper
   `layoutViolations` (overlapping siblings, children outside their parent)
   found the fault above in minutes, but only through a throwaway spec. As an
   MCP tool (`check_views`) or a Studio command it would let an agent or a
   user audit every view after a big change; it also missed a group frame
   overlapping a container frame once, so it should compare frames too.

17. **No bulk edit through the tools.** Moving the Forge code to
    `@radical/common` (2026-10-07) left 21 requirements and scenarios citing
    old file paths in their Evidence. `update_node` takes one node at a
    time, so the fix was a script driving the MCP client. A find-and-replace
    tool over node fields would do it in one call.
18. **`set_view_nodes` replaces the whole list.** Adding two elements to a
    view of 78 meant reading `views.json` (or `GET VIEW`) and sending all
    80 ids back. An `add`/`remove` form would avoid it. Again on 2026-10-09
    (state machines ADR): `GET VIEW` of a 67-element table view returned
    73 KB, more than Claude Code accepts as one tool result, so the ids had
    to be dug out of the saved output.
19. **The project's MCP server cannot serve a worktree.** `.mcp.json` points
    the server at `architecture/` in the main checkout; recording an ADR for
    a branch checked out in a git worktree (2026-10-08, calm drags) meant a
    throwaway script driving the worktree's own server over stdio, or
    editing the user's working copy. A `folder` argument on the tools (or a
    `switch_folder` tool) would let one server reach either.
20. **`search_model` takes no free text.** `search_model "physics"` answers
    "Unsupported query"; finding the ADRs about layout took a `LIST NODES
    WHERE (type = …) AND (label ~ … OR …)`. A plain query could fall back to
    a substring search over labels and descriptions.
21. **View tools disagree on the view parameter.** `set_view_nodes` takes
    `id`, while `smart_layout`, `align_nodes`, `grid_nodes` and
    `remove_alignment` take `viewId` (2026-10-08, Forge views ADR): the first
    call failed schema validation. One name across the view tools would do.
22. **Rebuilding the MCP server breaks the one that is running.** The build
    splits Smart Layout's ELK code into a chunk with a hash in its name
    (`dist/elkLayout-<hash>.js`) that `index.js` imports on first use. After
    `npm run build -w @radicaltools/mcp` a server started before the build
    still asks for the old name, so `smart_layout` fails with "Cannot find
    module …/dist/elkLayout-….js" until the client restarts the server
    (2026-10-13: the view "Decisions and requirements" could not be laid out
    after two nodes were added). Every other tool keeps working, which hides
    it. Build one file, or load the chunk when the server starts.
23. **`GET VIEW` answers with every node in full.** For a view of 55 nodes
    `search_model "GET VIEW <id>"` returned 72 000 characters, more than a
    client takes in one result, when the ids were all that `set_view_nodes`
    needed. There is no tool that adds a node to a view: the whole list has
    to be read and sent back.

### Reverse-engineered requirements (2026-10-06)

`architecture/` now holds 36 needs, 246 EARS requirements and 123 scenarios,
one group and one table view per area, reconstructed from the code, the e2e
tests and the manual. Each requirement cites its evidence (file:line) in
`rationale`; each scenario names the test that covers it, or says none does.
The comparison found these gaps.

**Probable bugs** (found by reading the code). All 13 fixed in #118, each with
a unit or e2e test:

1. **A milestone link can overwrite the live model.** `route.ts:190-194`
   applies `/s/<id>` with `restoreSnapshot`, which swaps in the milestone
   without a `liveBackup`. `saveDiagram` only protects the live model when
   that backup exists (`diagramStore.ts:4187`), so reloading while viewing a
   milestone saves the milestone as the live model. `selectMilestone` keeps
   the backup.
2. **Dropping a custom node type probably throws.** The palette lists custom
   types, but `Canvas.tsx:742-754` looks their size up in `NODE_SIZES`, which
   only knows the built-in types.
3. **Dragging a relation endpoint skips the metamodel check.**
   `RelationEdge.tsx:118-129` calls `updateRelation`, which does not validate,
   so a forbidden pair can be created.
4. **Boolean table cells toggle in Viewer** (`TableView.tsx:428-430`); every
   other cell is read-only there.
5. **Hidden relations still show** in the matrix and the Relations tab, which
   ignore `hiddenRelationIds` (`MatrixView.tsx:115-135`, `TableView.tsx:210-215`).
6. **View cards say "0 nodes" for whole-model views** (`RightPanel.tsx:1085`
   prints `nodeIds.length`, and an empty list means every node).
7. **"Root only" in the metamodel editor reads the wrong field**: it checks an
   empty `allowedParents`, not `allowedAtRoot` (`MetamodelEditor.tsx:262-268`).
8. **Not undoable:** Smart Layout and tree layout runs
   (`diagramStore.ts:2811-2995`), hiding an element or relation from a view
   (`diagramStore.ts:2306-2363`), and the AI's `reset_diagram`, which clears
   both undo stacks (`useDiagramFacade.ts:91-102`).
9. **Studio cannot open the `.radical` files the Hub downloads**: the desktop
   and browser pickers accept only `.c4.json`/`.json`
   (`apps/studio/src/main/index.ts:105-124`, `documentStore.ts:340`).
10. **Forge's Regenerate stacks a second copy** of the stage on top of the
    first (`RadicalForgeModal.tsx:350-404`).
11. **Generate wireframe shows without an API key** and then fails
    (`wireframeGenerator.ts:8` checks only the AI switch).
12. **Linking a milestone to a slide has no effect** on slides that carry
    their own model copy, which every new slide does
    (`diagramStore.ts:3870-3887, 4087-4095`).
13. **Canvas zoom tooltips advertise ⌘− / ⌘+** (`Toolbar.tsx:682, 689`), but
    only the Flow view handles those keys.

**Manual out of step with the code** (fix the manual, or build the feature):

- *Elements, relations, selection:* ⌘/Ctrl- and Alt-click do not add to the
  selection (only Shift); the selection bar appears with one node; the Delete
  key opens a dialog while the bar's Delete removes at once; dragging a node
  into a container does not re-parent it and nothing highlights; "everything
  is undoable" did not hold (bug 8, fixed in #118).
- *Getting started:* the Welcome screen shows on every browser load without a
  route, never in desktop or VS Code. It offers New model and Open; New model
  then asks for the metamodel (Radical metamodel by default, or C4) and where to
  keep the model (this browser, a file or a Markdown folder; file and folder
  only where the browser can write them back, the choice remembered per
  browser), with Create with Radical Forge only once an AI provider is set
  up. Open lists recent models, then this browser's models, a file, a folder,
  a Structurizr DSL workspace and the sample; a first visit also offers the
  sample under the two choices. In Chromium a file is kept, not imported:
  changes are saved back to it, and after a reload it needs access granted
  again. Manage models shows every model on one list (search, filter by
  place, a ⋯ menu per row) and reuses the same New model / Open steps.
- *Properties & governance:* the EARS subject comes from the element that
  *satisfies* the requirement, not the one it *constrains*; requirements have
  no status or MoSCoW priority; fitness functions have no trigger, automated
  flag or status.
- *Metamodel editor:* no controls for icon, collapsed size, root placement,
  enum default, "visible only when" or relation colour; presets are picked when
  a model is created, not in the editor. (The Diagram tab and every built-in
  type and relation are now described in the manual's Metamodels chapter.)
- *Views:* a new view starts with the whole model, not what is on screen;
  every card has a settings button and the treemap's Size/Levels live in its
  toolbar; the treemap drills in on double-click and has no inline expand; the
  matrix also creates and deletes relations; Scenario, Blueprint and Mockup
  have table tabs too; the wiki's single/multi page toggle is undocumented; a
  Flow view draws mockups as plain boxes; "create Flow view" shows only while
  no view plays the sequence.
- *Layout:* Smart Layout runs ten engines and anneals the best two (annealing
  is not a candidate); the live physics runs all the time, not only while
  dragging.
- *Presenting:* slides cannot be reordered; a Flow-view slide does not step
  through its sequence; Present hides the chrome but does not go full screen.
- *AI and Forge:* AI changes are applied call by call, not as one atomic,
  undoable patch; Hub suggestions appear in three stages, not every stage;
  the Gherkin export covers every scenario in the model; Enter in Quick Search
  and the Forge button in its bar are undocumented.
- *Files and VS Code:* Studio saves `.c4.json`, not `.radical` (it opens
  `.radical` since #118, bug 9); in the
  browser "Save as file…" downloads a copy and the model stays local; the
  VS Code commands are "Radical.Tools: Open current file / Open app", open
  only `*.c4.json`, leave the document unsaved after an edit, and use the
  local `apps/studio/out` build outside a packaged install.
- *README:* says `apps/mcp` is "empty for now".

### Alignments (2026-10-07)

Added in `feat/layout-alignment-constraints`: elements kept in a row or a
column per canvas (`LayoutConstraint` on `DiagramView.layoutConstraints`,
`DiagramData.defaultLayoutConstraints` for All elements). WebCoLa holds an
alignment of leaves itself; one with an expanded container is projected after
each tick (`projectGroupAlignments`), since WebCoLa constraints cannot name a
group; `enforceAlignments` (`packages/layout/src/constraints.ts`) is the
headless pass for Smart Layout, a new rule and the MCP server. Still open:

1. **The canvas and the layout disagree on sizes.** The canvas draws a
   container without children at its collapsed size and record types (ADR,
   requirement…) at their type's size (`deriveRFNodes`); Smart Layout and the
   physics place the stored size, which for a childless system is 80 px
   taller. Alignments centre on the drawn size (`drawnSize` in
   `packages/layout/src/geometry.ts`), but overlap checks and scoring still
   use the stored one, so such nodes keep more space than they show.
   `deriveRFNodes` should use `drawnSize` once the layout does too (measure
   Smart Layout before and after).
2. **Alignments (optionally ordered) and grids.** A grid is its ordered
   rows and columns plus a rank per line (`gridCells`, `constraintLines`);
   it is laid out in even cells only when made or given other columns
   (`arrangeGrid`), so later layouts may space its rows unevenly. A grid
   mixing elements inside and outside a container pulls the outside ones
   into the container's frame. Equal spacing along a row,
   "A left of B" without a shared line, a fixed position (Part 1, item 27)
   and a right angle would use the same `LayoutConstraint` type and both
   solvers. An ordered line keeps its members apart by the physics' own
   overlap distance; there is no "at least N px apart" yet.
3. **A row and a column that cross at two elements are refused**, rather
   than solved; three-way conflicts through chains of rules are not
   detected and leave overlaps. Contradicting orders on one axis are
   refused (cycle check in `checkAddAlignment`), also across rows.
4. **All elements' alignments are listed nowhere.** A view lists its own in
   its properties; All elements has no properties panel, so its alignments
   are seen and removed only on the canvas (guides, the × on a selected
   member, *Align… → Stop keeping aligned*).
5. **The MCP server aligns at the next `smart_layout`** (or when Studio shows
   the canvas): `align_nodes` records the rule without moving anything.
6. **Alignments with containers are held outside WebCoLa's solver.**
   Dogfooding: on `architecture/` (a column of three layer groups, a grid of
   seven groups in the first, a grid of 64–77 elements in each), expanding a
   second requirements group left the canvas shaking for good. Two causes
   are fixed: on a large model (local physics) the partners of the group the
   new children sit in stayed frozen and were put back after every
   projection, and a line inside a group stayed where it was when an outer
   line moved the group. What is left: the projection and WebCoLa's overlap
   removal can still pull against each other (overlap removal pushes a
   container across its line, the projection pulls it back), and on that
   model the physics did not come to rest by itself; a run with a projected
   alignment now stops after 4 s (`MAX_PROJECTED_RUN_MS`). A lasting fix
   would let WebCoLa hold the line, for example through a leaf per container
   pinned to its centre, or keep aligned containers rigid in the physics.

### Calm drags and pins (2026-10-08)

Added in `feat/calm-drag`: a drag moves only what is dragged and pins it on
the drop (`DragMode` and `clearOverlaps` in
`packages/layout/src/liveColaEngine.ts` since 2026-10-13, `PinConstraint` in
`packages/common/src/c4.ts`; ADR "Calm drags pin what they drop"). Still open:

1. **Smart Layout unpins rather than honours pins.** It is run on purpose
   to arrange the whole canvas, so it places every element anew and removes
   the canvas's pins (one undo step with the layout; nothing when it keeps
   the current layout). Laying out around pinned elements would mean fixed
   positions inside the ELK candidates and the annealer: a core-IP change
   that needs its own benchmark.
2. **Between layouts, pins only accumulate.** Every drop pins, so a diagram
   arranged by hand ends up mostly pinned and the physics has little it may
   move (an expand next to pinned elements can leave overlaps) until the
   next Smart Layout. An *Unpin all* on All elements (which has no
   properties panel), unpinning a selection from the selection bar, or a
   setting that makes drops not pin, are the next steps.
3. **A calm drop pushes rigidly and greedily.** Each covered element moves
   whole along its axis of least overlap; it never chooses a direction with
   more room, and after `CALM_MAX_PUSHES` pushes a dense spot keeps its
   overlaps. Pinned elements are pushed too and stay pinned where they land
   (`fix/drop-on-pinned`, 2026-10-09: an overlap with one used to stay, which
   read as the physics switching off). One held by lines on both axes (a grid
   cell) is never pushed: the dropped element moves off it instead, and stays
   on it when lines hold that one on both axes too.
4. **The push drag needs a key.** Alt is the default connection modifier, so
   the physics drag is on ⌘/Ctrl; on macOS, Ctrl-click opens the context
   menu, so it is ⌘ there. There is no menu switch for it.
5. **A container grown by a calm drag of its child shifts the child for a
   frame** when it grows left or up (React Flow keeps the child's position
   relative to its parent until the pointer moves): the engine reports the
   child relative to the parent's new place, one worker message late.

6. **A laid-out diagram is left alone (2026-10-13, `fix/layout-stands`).**
   The physics used to relax every diagram under 150 nodes as a whole after
   each rebuild (open, view switch, undo, Smart Layout). Measured with
   Smart Layout's own composite score, raw winner against the same layout
   after the physics: the sample's All elements 16 937 → 20 713, Core
   Banking 5 → 47, System Context 0 → 14 (every element moved, by up to
   1 690 px); only a Forge-built model with 76 root elements improved
   (353 349 → 303 022), because the engines spread it over
   10 700 × 12 300. Now the engine (moved to
   `packages/layout/src/liveColaEngine.ts`) rests on a rebuild, moves only
   new nodes with their surroundings at every size (and the members of an
   alignment just made), and `relaxLayout` runs the whole-diagram
   relaxation in one go as a Smart Layout candidate, kept only when it
   scores better (ADR "A laid-out diagram stands"). Still open:
   - A push drag (⌘/Ctrl) on a diagram under 150 nodes still relaxes the
     whole diagram, as before: it is the gesture that asks for the physics,
     and with only the relation neighbourhood free, a dragged element with
     no relations pushes nothing (it stops against the frozen ones).
   - An element an agent adds through the MCP server while Studio is open
     arrives with the reload of the folder, so it is not "new" to the
     physics and stays where the server put it, on small diagrams too now.
   - The composite score decides between the engines' winner and its
     relaxation, and it does not see everything the eye does: on the
     sample's All elements the relaxed layout scores worse (223 crossings
     against 145) but has the people on top and the external systems to
     the right, which the physics' separation constraints give and the
     winning ELK candidate does not. The metamodel editor's diagram keeps
     its own physics pass for the same kind of reason (Smart Layout alone
     spreads its category frames over a mostly empty canvas). A term for
     the C4 reading order in the score would let Smart Layout make that
     call itself.
   - The engines' sparse result on diagrams with many unrelated root
     elements is covered by the relaxed candidate only below 150 nodes.
7. **A relation that ends on an open group has no force in the live
   layout.** WebCoLa links leaves, and an open group is drawn around its
   children, so the relation is left out (66 of 351 on All elements of a
   Forge-built model). An element on the canvas with only such relations
   stayed behind when the diagram moved; `holdByGroups` brings it back by
   the group, through free room only. Both ways of giving every such
   relation a force were tried and dropped: a link to the nearest leaf
   inside the group bends what is inside it (a state machine's row of
   states, pulled by its entity), and pulling every related element toward
   the group after each step never comes to rest against WebCoLa's own
   forces (still moving after 46 s). Since item 6 this matters only while
   the physics moves something; Smart Layout counts these relations.
8. **Smart Layout keeps a layout with a stray pinned element.** With an
   element pinned far from the diagram, Smart Layout reported that the
   current layout already scores best and changed nothing, so the pin
   stayed too. The score barely counts one very long relation.

### Found by exploratory runs

Runs made from `docs/EXPLORATORY-TESTING.md`. Each entry was reproduced
twice from a fresh page by the run and once more by hand.

**Run 1, 2026-10-13, commit a8dc297.** Covered: Smart Layout with repeat
and undo, collapse and expand with undo, canvases kept separate, an add
into a container with undo, redo and reload, Viewer and Presenter, actions
during a running Smart Layout. Not covered: the MCP server, files and
folders, alignments, pins, milestones, model sizes, Hub.

1. ~~**A reload moves a container's children down after the physics placed
   them.**~~ Fixed 2026-10-13. Add an element into an
   open container, or collapse and expand it, then reload or switch views
   and back: the children the physics left about 60 px below the
   container's top were drawn at 110 px (bookstore, Containers: Web App
   and API from y 60 to 110; sample, Core Banking: seven elements by 20 to
   72 px), while the saved document kept 60. `deriveRFNodes` in
   `packages/ui/src/store/diagramStore.ts` drew every child of an open
   parent at 110 or lower, on every rebuild; until PR #176 the physics ran
   again after each rebuild and put them back, which hid it. The canvas
   now draws a child where the model has it, and lower only when the file
   has it on the parent's header (`LIVE_CHILD_TOP_MIN`, the least the
   physics keeps). Left as it was: the physics keeps about 60 px above a
   container's children where Smart Layout leaves 120, so the first add or
   expand inside a laid-out container moves its children up by that much,
   close under a one-line label and onto the second line of a longer one.
   Giving the physics the layouts' header room needs a taller frame above
   the group's bounds, and the alignment and calm-drag code that reads the
   frame to follow.
2. ~~**Smart Layout in Viewer or Presenter is saved.**~~ Fixed 2026-10-13.
   `runSmartLayout` and `runTreeLayout` asked
   for the document to be written right after the layout
   (`window.__radicalFlushPersist()`), and `flushPersist` in
   `apps/studio/src/renderer/src/persistence/autosave.ts` did not check
   the perspective (only the subscription that schedules a save did). The
   canvas went back to the Designer layout on return, but the file held
   the Viewer's, and a reload showed it; a collapse made in Viewer before
   the layout was saved with it. The layouts now ask for that save in
   Designer only, and any save made while exploring writes the model
   Designer had.
3. ~~**Smart Layout lands on another view when the view is switched while
   it computes.**~~ Fixed 2026-10-13. On the sample's
   All elements (about three seconds), opening Core Banking during
   "Scoring layouts…" put All elements' positions on Core Banking's 14
   elements and saved them there. `runSmartLayout` took its input before
   the await and applied the result to whichever canvas was active
   afterwards. A layout whose canvas is no longer the one shown (another
   view, perspective, milestone or model) is now dropped, with a notice.
   Not done: applying it to the canvas it was started on, which is not on
   screen any more. Elements added or removed while a layout runs are
   still not checked for.

Seen, not counted: the camera saved with a view stays where Smart Layout's
fit left it after an undo of the layout.

**Run 2, 2026-10-13, commit 44c4dc5.** Covered: the MCP server over stdio
(labels and properties through a restart, refusals, alignments, grids,
views, milestones), folder-backed models with the server writing to the
same folder, milestones in Studio, generated models of 0, 3, 119, 126 and
335 elements, the seven Hub blueprints opened in Studio, drags and pins
with undo. Not covered: the Hub app, the metamodel editor, writing in the
wiki, alignments made in Studio, milestone edits, `.radical` files, export
and import, Forge, a model of exactly 150 elements.

4. ~~**Smart Layout depends on the order of the nodes in the document.**~~
   Fixed 2026-10-13. The same bookstore diagram from the same positions
   got three different layouts with `nodes` in file order, sorted by id
   and reversed. The folder format writes siblings sorted by id, so a
   folder-backed model read back had another order than the one Studio
   held in memory: after a reload, Smart Layout rearranged all six
   elements of a layout it had just called best, and the MCP server's
   `smart_layout` picked another winner than Studio on the same folder.
   `projectToVisibleGraph` in `packages/layout/src/geometry.ts` now hands
   the engines the nodes in id order, as it did the relations. Layouts of
   models kept in browser storage or a `.radical` file change once with
   it. Still open: on the same folder Studio and the server now pick the
   same winner, but their positions differ (bookstore, All elements: the
   root elements by up to 134 px), and the server replaces Studio's with
   its own, which Studio then calls best. Not found why; Studio runs a
   separation pass over the root elements after the layout that the
   server does not (a guess).
5. ~~**A reload while a view is shown writes that view's layout onto All
   elements.**~~ Fixed 2026-10-13. Found with a milestone selected, but any
   reload with a view in the address did it: a document is saved with its
   nodes where the shown canvas has them, it opened on All elements with
   those in its nodes, and the first switch to the view stored them as
   All elements' own (bookstore, System Context: Bookstore from 860×350 at
   x 0 to 360×260 at x 250, its children left outside it; the sample: 24
   elements moved). The store now opens a document with its nodes at
   `defaultPositions` (`atDefaultPositions`).
6. ~~**`update_relation` sets a relation type the pair does not allow.**~~
   Fixed 2026-10-13. The MCP server (and the AI chat, which shares the
   tool) refused `add_relation` person → system `constrains`, but accepted
   the same relation added as `interacts` and then updated to
   `constrains`; `get_issues` reported no issue. `checkAddRelation` and
   `checkPatchRelation` in `packages/common/src/model.ts` now check the
   relation's own type, the validation flags a relation whose type does
   not have its pair (`bad-rel-type`), and an element is not retyped away
   from under a relation nothing allows for the new pair (the relation
   takes the type that fits when there is one).
7. ~~**A drag re-frames open containers it does not touch.**~~ Fixed
   2026-10-13. After Smart Layout, dragging Customer away from Bookstore
   changed Bookstore's frame by x −30, y +60, width +60, height −30; on
   the sample's Core Banking, dragging one database changed the frames of
   three groups the drop did not touch. The engine reported every open
   group at its own bounds with the first drag. A group now keeps the
   frame the model has until something in it moves (`keptFrames`), and
   moves with it when it is dragged as a whole. The container an element
   is dragged or added inside of is still refit to the physics' padding
   (the leftover under item 1).

Decided after the run: a drag is an undo step of its own (it had none:
the toolbar's Undo stayed disabled after one, and one undo after "add an
element, then drag another" took back both). `liveGrab` keeps the model as
it was, `liveRelease` makes the step from it when something moved.

Seen once: `align_nodes` with a `viewId` accepts an element that is not in
that view; a system may `interacts` with itself through the server; the
sample's System Context opens with the "not laid out yet" hint.

**Run 3, 2026-10-13, commit 356b8dc.** Covered: the drag undo step on one
canvas (single, child, container, multi-selection, push drag, drops that
push, rows and grids, redo, reload), across a view switch and in a
milestone; a relation's own type through the MCP server; frames kept
through drags and an add; a `.radical` file reloaded on a view; the Hub
app (all 128 concepts by link, links inside a tab, Add to Studio);
adding, using and deleting a node type; alignments and grids made in
Studio; milestone edits (propagate, discard); models of 149, 150 and 151
elements. Not covered: writing in the wiki, Presenter and slides, "Save
as new milestone", export and import, folder models with outside edits
on a view, expand and collapse next to kept frames, most of the
metamodel editor, Hub filters and search.

8. ~~**Undo next to a milestone destroys milestones, or replaces the live
   model.**~~ Fixed 2026-10-13. Open a milestone and press Undo: the
   canvas showed the live model while the milestone was still the active
   one, and the next edit saved with "Propagate" made every milestone a
   copy of the live model (the sample: v1 from 11 nodes to 65, as v2, v3
   and v4). Or: drag in a milestone, discard, Undo on the live model: the
   live model became the milestone (65 nodes to 11), and a reload kept
   it. A history entry did not say which model it belonged to. The live
   model's history is now parked while a milestone is shown and comes
   back with the live model; a milestone starts with none, and loses its
   own when it is left or its edits are committed. Opening a milestone is
   no undo step any more.
9. ~~**Undo on another canvas than the one the step was made on puts that
   canvas's layout on the one shown.**~~ Fixed 2026-10-13. Drag on
   Containers, open System Context, Undo: System Context got Containers'
   positions (Bookstore from 360×260 at x 250 to 860×350 at x 0) and
   saved them. A history entry now keeps the canvas it was taken on and
   All elements' positions, and undo and redo go back to that canvas.
10. ~~**Hub: a concept link followed in a tab that already shows the Hub
    opens nothing.**~~ Fixed 2026-10-13. The address was rewritten to
    `#/browse` while the concept was still loading, and the second of the
    two events the navigation fires read that. The state-to-address
    effect in `apps/hub/src/HubApp.tsx` now waits for a concept that is on
    its way.
11. ~~**From 150 elements, an element dropped after a ⌘/Ctrl drag does not
    stay where it was put.**~~ Fixed 2026-10-13. It was pinned at the
    drop, then ended 3 435 px lower, below a grid of 150. Two causes. The
    physics kept people above everything else and external systems to
    the right on every diagram, also one whose layout does not have them
    there: the first element it was free to move was thrown across the
    diagram to satisfy that (the same rule put the actor of the very
    first report above the whole diagram). On a diagram that has a layout
    it now keeps that order only where the layout has it. And the drop
    took the place the solver had pulled the element to, not the
    pointer's.
12. ~~**Studio deletes a node or relation type that elements use.**~~
    Fixed 2026-10-13. No question, and the validation then listed the
    elements as of an unknown type; the MCP server refused the same
    deletion. The store now refuses it with the count
    (`checkRemoveNodeType`, `checkRemoveRelationType` in
    `packages/common/src/model.ts`).
13. ~~**An element grabbed within about 1.5 s of a view opening flies
    away.**~~ Fixed 2026-10-13. Smart fit kept refitting the camera every
    frame while the layout moved, and a drag counted as moving: 60×120 px
    of mouse travel moved an element 1 958×1 042 px. A drag that moves an
    element now takes the camera, as a pan or a zoom does.
14. ~~**Adding an element at the root re-frames open containers it does
    not touch.**~~ Fixed 2026-10-13. A person dropped far from Bookstore
    changed Bookstore's frame by x −80, y +60, width +120, height −30. A
    group's kept frame was dropped when its bounds changed, and the run
    for the new element computes them slightly differently; it is now
    dropped when one of the group's leaves moves against the others.

Left as it is from item 11's cases: below 150 elements a ⌘/Ctrl drag
still relaxes the whole diagram (a few pixels of drag on a tidy grid of
149 moved all of them, by stress alone now, the farthest by some 3 000 px).

To decide: an element of a custom node type is drawn as React Flow's
default node, dark text on the dark canvas (the editor says styling
"lands in a follow-up"); a Hub ADR imports into a plain C4 model with a
"metamodel" warning and then shows as an unknown type; undo of a Hub
import leaves its `hubTemplates` record; `upsert_relation_type` that removes a pair relations use reports no new
warning though `get_issues` then lists it; "Keep in a row" on two root
elements moved all six elements of the view.

**Runs 4, 5 and 6, 2026-10-13, commit 24069b1**, made at the same time,
each in its own areas. All 25 were fixed on 2026-10-14, each with a test
that fails without the fix; the "To decide" lists are still open.

*Run 4.* Covered: the wiki (reading; writing on overview and element
pages, 57 elements of every kind offered; undo, redo, rename, delete; in
Viewer; with a milestone shown), Presenter (cards, play, keys, deep
links, focus, add, rename and delete of a slide), Viewer, milestones
(save as new, rename, delete, discard, restore), export and import (PNG,
SVG, download and open, move to a file). Not covered: slide reorder and
capture, several presentations, the diff toggle, copy to clipboard,
Structurizr import.

15. ~~**"If …, then the system shall …" gains a ", then" when written, and
    one more with each rewrite.**~~ "If the daily limit is exceeded, then
    the system shall refuse the transfer" is kept with the condition "the
    daily limit is exceeded, then"; Rewrite and Enter with no change adds
    another. It is the sentence Studio itself composes for an
    unwanted-behaviour requirement. `splitEarsSentence` in
    `packages/common/src/metamodel/ears.ts`: with a comma before it, "then
    the system" matches with "then" in the wrong group. "When …, then the
    system shall" and "While A, if B, then the system shall" the same.
    Fixed 2026-10-14: The "then" after the comma is dropped before the
    stretch is read as the end of the condition or the subject.
16. ~~**An element added under its parent in the wiki, or on a view, lies
    outside the parent on All elements.**~~ "Search Service" written on
    Bookstore's page is at x 1000 on All elements, outside Bookstore's
    860 px frame and over Payment Provider; a container dropped into
    Bookstore on Containers is below the frame on All elements. Saved. A
    node a canvas has no position for keeps the parent-relative place it
    got on the canvas it was added on, and nothing places it on the
    others or refits the parent there. For the wiki, the write also runs
    the live layout on the wiki view's own positions, which nobody sees.
    Fixed 2026-10-14: A canvas gives the elements it has no place for
    one of their own when it is shown and when a document is loaded:
    right of the siblings it has placed, top-aligned, with the ancestors
    refit (`placeUnplaced` in `packages/layout/src/geometry.ts`), and
    the live layout settles them with their surroundings.
17. ~~**A milestone picked in Viewer stays the active one in Designer over
    the live model, and "Current (live)" picked in Viewer leaves the
    milestone as the live model.**~~ The first, followed by a drag and
    "Propagate", makes every milestone a copy of the live model (11, 17,
    30, 65 nodes to 65 each); the second saves the milestone as the live
    model (65 nodes to 11). `setAppMode` parks and restores the nodes and
    relations (`__preModeLayout`) but not `activeSnapshotId` or
    `liveBackup`.
    Fixed 2026-10-14: Leaving Designer sets aside the milestone shown,
    the live model behind it, the sequences and the diff along with the
    nodes, and the return puts them back; Viewer and Presenter keep no
    undo steps of their own, so Designer's are where they were.
18. ~~**Adding a slide in Presenter while a milestone is shown saves the
    milestone as the live model.**~~ `buildPersistData` in
    `apps/studio/src/renderer/src/persistence/autosave.ts` replaces the
    nodes `saveDiagram` took from `liveBackup` with the parked ones, which
    are the milestone's. Same root as 17.
    Fixed 2026-10-14: A save made while exploring writes the live model
    of the Designer that was left: the one it had set aside when it was
    showing a milestone (`parkedLiveModel`).
19. ~~**In Presenter, after the card of a milestone slide was clicked, the
    other slides show the milestone's model**~~, and the presentation plays
    with it, until Designer is visited. `previewSlide` swaps in a slide's
    model and never puts the live one back for a slide that has none.
    Fixed 2026-10-14: A slide without a model of its own puts back what
    the card of a milestone slide replaced.
20. ~~**Ctrl/Cmd+Z undoes Designer's last step from anywhere.**~~ In Viewer
    and Presenter (the step is then gone from Designer: Undo disabled,
    Redo changes nothing), and while typing in a text field (a typo
    "undone" in the wiki's writing line deletes the requirement written
    before it; in a page title, the rename before it). The handler in
    `apps/studio/src/renderer/src/components/Toolbar.tsx` is on `window`
    and does not look at the perspective or the focus.
    Fixed 2026-10-14: The keys are left to a text field that has the
    focus, and undo and redo do nothing outside Designer (the store
    refuses them too, and takes no step for what is collapsed or laid
    out in Viewer and Presenter).
21. ~~**"Restore to live" leaves the restored milestone marked as the one
    shown.**~~ The next edit of the live model asks about "editing a
    milestone", and Undo then Propagate overwrites that milestone; with
    another milestone shown, the canvas shows the restored one and the
    live model is not changed at all. `restoreSnapshot` sets
    `activeSnapshotId` and leaves `liveBackup` alone.
    Fixed 2026-10-14: "Restore to live" makes the milestone the live
    model, with no milestone shown, as one undo step; while another
    milestone is shown the live model is shown first, and edits of that
    milestone not yet kept or dropped are asked about first.
22. ~~**Export as PNG or SVG is offered on the wiki, table, matrix and
    hierarchy views and does nothing there.**~~ No file, no notice.
    `exportAs` in `apps/studio/src/renderer/src/hooks/useExport.ts`
    returns when there is no canvas.
    Fixed 2026-10-14: Export draws the page of the view shown when there
    is no canvas (as the window shows it), and a failed export says so.

To decide (run 4): deleting in the wiki says "This cannot be undone from
here" and Undo undoes it; a page title can be emptied (label ""); an
export is the window's cut, not the view; a drag in a milestone leaves a
pin in the live document, also after Discard; an element written while a
milestone is shown is added to the view's node list, which the live
model shares; the wiki search does not find words of a relation
sentence; other EARS round trips that change words ("Whenever possible"
to "When possible", "The system shall: log" to "shall : log"); Home and
End do nothing while a presentation plays.

*Run 5.* Covered: the metamodel editor (reset to C4, properties,
cardinality, add and delete a type, the Diagram tab), the properties
panel and the selection bar (Parent field, Move to, wrap and unwrap,
delete prompts, typing), sequences, table, matrix, hierarchy, quick
search, views next to undo, the wizards for ADR, need, requirement and
scenario (the validation stayed empty after each: no finding there). Not
covered: changing a relation's type or ends in the panel, reparent by
drag, table cells beyond a name, matrix clicks, playing a flow view,
state machines and mockups through the palette.

23. ~~**"Reset to C4 preset" on a model with governance elements leaves
    them as unknown types, with no way back.**~~ The confirmation says only
    that custom types will be lost; on the order-machine fixture the
    validation goes from 0 to 13, Undo stays disabled, and the editor has
    no control to return to the Radical metamodel. `resetMetamodelToC4`
    has no check, and the metamodel is not part of a history entry.
    Fixed 2026-10-14: The reset is refused while the model holds
    elements or relations the preset has no type for, and says which
    (`checkReplaceMetamodel`).
24. ~~**Enum options cannot be typed.**~~ The field re-parses its text on each
    key, so a comma or a space at the end never survives: `gold, silver,
    bronze` becomes one option `goldsilverbronze`. Pasting works.
    `PropertyEditor` in
    `apps/studio/src/renderer/src/components/MetamodelEditor.tsx`.
    Fixed 2026-10-14: The field keeps the text as typed and parses it on
    the way out.
25. ~~**The Parent field in the properties panel freezes the tab when a
    parent is given its own child as parent, and leaves a moved element
    outside its new parent.**~~ It calls `updateNode({ parentId })`, and
    `checkNodeUpdate` has no descendant check and neither rebases the
    position nor refits the parent, which "Move to…" and a drag do
    (`checkReparent`, `reparentNodes`). Whether the MCP server's
    `update_node` with a `parentId` shares this was not checked.
    Fixed 2026-10-14: The field moves the element as "Move to…" does (so
    does `updateNode` given only a parent), and `checkNodeUpdate`
    refuses an element's own descendant as its parent.
26. ~~**"Wrap into…" is several undo steps.**~~ One Undo after wrapping two
    elements leaves one in the new group and one out; it takes one per
    wrapped element plus one. `wrapSelectionInNewParent` calls `addNode`
    and `updateNode`, each with its own step.
    Fixed 2026-10-14: The whole wrap is one step.
27. ~~**Editing a sequence or a view is not an undo step.**~~ Removing or
    moving a step, a step's note, deleting a sequence (no confirmation,
    and no way back), creating or deleting a view: Undo after any of them
    takes back the edit made before instead. The sequence actions and
    `addView`, `removeView`, `renameView` never push a step; a history
    entry carries the views (so they are restored as a side effect) but
    the sequences only for `clearModel`.
    Fixed 2026-10-14: Adding, renaming and deleting a view or a
    sequence, adding, removing and moving a step, clearing a sequence, a
    step's note and the sequence a view plays are undo steps; a history
    entry carries the sequences.
28. ~~**Reordering steps moves a note onto another step.**~~ In a sequence
    where not every step has a note (any new one), `reorderSequence`
    splices the shorter notes array at the relations' indexes.
    Fixed 2026-10-14: The notes are padded to the steps before a move.
29. ~~**Quick Search hides the element it finds**~~ when its container is
    collapsed on All elements and expanded in the view (it collapses the
    container in the view and saves that), and does not open a container
    collapsed in the view. `expandAncestors` in
    `apps/studio/src/renderer/src/components/QuickSearch.tsx` tests the
    model-level `collapsed`, and collapse is per view.
    Fixed 2026-10-14: Quick Search opens the containers that the view
    shown has collapsed (`expandAncestors` in the store, one undo step).
30. ~~**Unwrap puts a group at a place where its contents are not allowed.**~~
    Unwrapping Bookstore around a group of containers leaves the group at
    the top of the model with three validation warnings; "Move to… →
    Canvas root" refuses the same. `unwrapNode` checks direct children
    only, not `misplacedInGroup`.
    Fixed 2026-10-14: Unwrap asks `checkUnwrap`, which looks into the
    groups among the children.
31. ~~**Undo brings back an element whose type was deleted since.**~~ Delete
    the element, delete its type (allowed, none left), Undo: the element
    is back as an unknown type. The metamodel is not in a history entry.
    Fixed 2026-10-14: When the metamodel loses a type (a type deleted,
    the preset reset), the undo and redo steps that hold elements or
    relations of it, and those beyond them, are dropped.
32. ~~**A custom property whose key is `type` edits the element's type**~~
    (and `id`, `parentId`, `x`, `label` … are open the same way): the
    editor accepts any key, and properties are plain fields of the node.
    Fixed 2026-10-14: A property cannot be keyed `id`, `type`,
    `parentId`, `x`, `y`, `width`, `height` or `collapsed` (a
    relation's: `id`, `sourceId`, `targetId`, `relationType`): the
    editor takes a key when the field is left and refuses these,
    `upsert_node_type` and `upsert_relation_type` refuse them, the
    validation lists them, and the properties panel does not show such a
    property.
33. ~~**An enum property without a value shows its first option as if
    set**~~, so that option cannot be chosen, and a required one stays
    "missing". The select has no empty option
    (`packages/ui/src/components/RightPanel.tsx`).
    Fixed 2026-10-14: The select has a "(not set)" option while there is
    no value.

To decide (run 5): the manual's metamodel editor section lists an icon,
a collapsed size, an enum default, "visible only when" and a relation
colour that the editor does not have; the manual says a click drills
into the hierarchy view, it is a double click; Quick Search exists on
structure views only; typing in the properties panel is one undo step
per key; deleting a relation leaves its id in a sequence; clearing a
name in the table removes `label`; the editor accepts a minimum of
instances above the maximum; "Delete node (and children)" in the panel,
Delete sequence and Delete view ask no confirmation.

*Run 6.* Covered: folder-backed models with edits made outside Studio (on
a view, in Viewer, with a milestone shown, during a drag, during Smart
Layout; broken, cut and emptied files; moved directories), the MCP server
(views, sequences, slides, milestones, move and delete, alignments,
`get_selection`, 34 `search_model` queries, tempIds, restarts, two
servers on one folder, a Forge run, Studio open while the server
writes), containers three and four levels deep with collapse, drag and
expand, undo next to views and deletes. Not covered: the desktop build's
own folder watcher, a call while Studio is saving, per-view against
model-level collapse, the Parent field. The MCP server gave no finding.

34. ~~**An outside edit that arrives while Viewer shows a view puts All
    elements' layout on that view.**~~ Folder model on System Context,
    Viewer, a label changed in a file, back to Designer: the view is
    drawn with All elements' positions (Bookstore from 360×260 at x 250
    to 860×350 at x 0), and the next edit saves them as the view's.
    `loadDiagram` parks the freshly loaded nodes (at All elements'
    positions) in `__preModeLayout` under the view's id, and `setAppMode`
    puts them back under it.
    Fixed 2026-10-14: A load made outside Designer sets the new nodes
    aside where the view Designer had open has them.
35. ~~**A sidecar file Studio cannot parse silently empties that part of
    the model, and the next edit deletes the file.**~~ A trailing comma in
    `relations.json` (or git conflict markers, or a file caught half
    written): "0 relations", no message, and after the next drag the
    file is gone from the folder; a cut `views.json` loses every view; a
    cut `_layout.json` is rewritten with every element at 0,0 and size
    0. The MCP server refuses the same folder ("Malformed JSON in
    relations.json"). `readJson` in
    `packages/common/src/formats/mdFolder.ts` returns undefined on a
    parse error, the callers fall back to empty, and the writer prunes
    the file as stale. A broken `snapshots.json` would lose every
    milestone the same way (not run).
    Fixed 2026-10-14: A file that is there and does not parse is an
    error that names it (`MalformedFolderFileError`). Studio says which
    file, keeps the model on screen when it was open, and saves nothing
    to the folder until a read succeeds; the folder is read again when
    it changes.
36. ~~**Undo of a drag takes back an outside edit that arrived during the
    drag.**~~ The outside change disappears from the canvas and from the
    folder, with no notice. `liveGrab` keeps the model from before the
    drag (the drag undo step, PR #178); `loadDiagram` forgets the history
    but not that copy, and `liveRelease` pushes it.
    Fixed 2026-10-14: A load forgets the copy a drag in progress keeps
    for its undo step.
37. ~~**Adding or deleting a view is not an undo step, yet Undo and Redo of
    other steps add and delete views.**~~ The same as item 27, seen from
    the views: one Undo after "drag, New view" removes the view and
    undoes the drag; with something on the redo stack, Redo after New
    view removes the new view. Redo is not cleared by a view action.
    Fixed 2026-10-14: See item 27.
38. ~~**Collapsing one container in a model nested four levels deep: the
    canvas does not come to rest, and elements of other containers end
    outside their frames or on top of each other.**~~ Generated model, 2
    systems × 2 groups × 3 containers × 5 components, tidy at the start:
    after one collapse 17 to 41 elements still move in every 3 s sample
    two minutes later, two containers of the untouched system overlap by
    116×275, and a reload shows another picture than the screen. After
    Smart Layout it rests in 9 s but leaves children 12 to 26 px outside
    their frames. On the sample, collapsing Digital Channels leaves Event
    Bus 24 px outside Banking Services and moves 46 of 65 elements. Not
    looked into; the numbers match the 40-element neighbourhood the
    physics frees around a change, reaching into containers whose frames
    and other children stay fixed.
    Fixed 2026-10-14: A container that is collapsed shrinks where it
    stands and nothing else moves: the live layout took it for a new
    element and freed its surroundings.
39. ~~**An element added into a collapsed container that was dragged lands
    on the container's header when it is expanded**~~, over its label and a
    sibling, and a reload moves it again. Without the drag it is placed
    properly. The pin the drag leaves on the container seems to keep its
    children from being seeded on expand (a guess).
    Fixed 2026-10-14: An element dropped on a collapsed container goes
    beside the others in it, below the header, and a container that is
    opened is fit to what it holds.

To decide (run 6): the manual says a parent can be changed by dragging an
element into another container, and no drag does; an outside edit while
a milestone is shown puts the user on the live model without a word; a
folder emptied while open gives an empty canvas and no message;
`delete_view` leaves slides pointing at the view and `delete_relation`
leaves the id in a sequence, with `get_issues` silent (Studio does the
same); `create_view` and `set_view_nodes` drop unknown ids silently
where `update_view` refuses them; a tempId equal to an existing id
shadows it; `forge_finish` names five views also when only one exists;
`search_model` answers an unknown field with 0 rows and no message; a
directory renamed outside Studio is renamed back at the next save;
`delete_node` leaves the ids in the saved positions.

### Radical Forge over MCP (2026-10-07)

Added in `feat/forge-mcp`: the MCP server runs Radical Forge with the
client's own model (`apps/mcp/src/forge.ts`: `forge_start`, `forge_clarify`,
`forge_generate`, `forge_complete_stage`, `forge_wireframe`,
`forge_import_hub_concept`, `forge_finish`, and a `forge` prompt). The stages,
their prompts, the clarifying-question prompt, the Hub matches per stage, the
wireframe prompt and the Hub import moved from Studio to
`packages/common/src/ai/forge`, `ai/systemPrompt.ts` and `hubImport.ts`, so
the wizard and the server send the same text. Still open:

1. **The run lives in the server's memory.** Restarting the server (or the
   client) loses the answers, the stage summaries and what each stage added;
   `forge_start` with the run's `needId` starts over from the same need.
2. **The agent asks the clarifying questions in its chat.** MCP elicitation
   could show them as a form, like the wizard, where the client supports it.
3. **The server's Hub catalogue is the copy bundled at build time**, while
   Studio in production reads hub.radical.tools; after a catalogue change the
   two can suggest different concepts until the server is rebuilt.
4. ~~**Nothing arranges the new elements during a run.**~~ Fixed in
   `feat/forge-views-arrange`: each stage's elements are filed into their
   view (Conceptual, Logical & physical, Governance) with a place beside what
   is there, and `forge_complete_stage` has the agent ask about a row, column
   or grid and Smart Layout (`forge_arrange`). All elements still gets the
   single-row placement of `placeNewNode`.
5. **The agent's own tools are not limited during a stage.** Studio leaves
   the metamodel, presentation and milestone tools out of a Forge stage; the
   server only tells the agent not to use them.

### Forge views and arranging stages (2026-10-08)

Added in `feat/forge-views-arrange` (ADR "Forge files its output into three
views"): a Forge run files each element into Conceptual, Logical & physical
or Governance, places new elements in a landscape block beside what the
canvas shows (Studio's AI runner too), and after each stage asks about a
row, column or grid and Smart Layout. Still open:

1. **The Forge panel covers the middle of the canvas**, where a stage's new
   elements land; the user sees them only around its edges until they close
   or move past it.
2. **Relations across layers show on none of the three views** (satisfies,
   traces-to, constrains). A fourth "Traceability" view, or showing an
   off-view endpoint as a ghost, would make them visible.
3. **The arrangement covers the whole stage.** There is no per-type choice
   (e.g. a grid of requirements but a row of people), and the panel cannot
   take it back; Align… on the canvas or `remove_alignment` can.
4. **A stage whose view does not exist yet runs on All elements** in Studio
   (an empty view shows the whole model), so the user watches the whole
   model until the stage ends and its view opens.

### Hub matching (2026-10-08)

Added in `feat/hub-matching` (ADR "Hub matching ranks, the model picks"):
IDF- and field-weighted keyword ranking with light stemming and synonym
groups, `searchText` (node content) in the catalogue index, the fitting
blueprint first with its `hubRefs` lifted, and the model picking at most
five of up to 60 candidates per stage in the clarify call. Benchmark:
`packages/hub-catalogue/tests/hubMatching.test.ts` (14 tuning briefs,
6 holdout briefs). Holdout, keyword step: precision 0.18 → 0.41, recall
0.23 → 0.44, expected concepts among the candidates 0.44 → 1.0. Still open:

1. **The model's pick is not measured yet.** `hubMatchingModel.test.ts`
   needs `HUB_BENCH_ANTHROPIC_KEY`; run it once and set floors from it.
2. **The concept's content does not reach the stage prompt.** The model
   gets a picked concept's name, description and tags, not its EARS
   action, threshold, ADR decision or template parameters, so it
   paraphrases instead of instantiating (step 4 of the proposal).
3. **No provenance.** A generated element that follows a Hub concept only
   names it in its description; recording the concept id (as
   `HubImportRecord` does for imports) would allow de-duplication and
   "update from the Hub" (step 5).
4. **Import from Forge is not part of the run.** An imported concept lands
   beside the model, outside the Forge views, unlinked to the need, with
   template parameters not filled from the brief (step 6).
5. **The blueprint threshold misses short briefs** (holdout: 1 of 3; food
   delivery ranks e-commerce over marketplace). The model can still pick a
   blueprint from the C4 candidates.
6. **Synonym groups are hand-written and English**, and hub.radical.tools
   serves `searchText` only after the Hub is redeployed.
7. **Scenarios and Mockups get no Hub concepts**; the catalogue has no
   Gherkin or screen content.

### State machines (2026-10-09)

The governance preset has event-driven hierarchical state machines
(`state-machine`, `state`, `pseudostate`, `event`; `transition`,
`lifecycle-of`, `emits`) with SCXML semantics, reference properties for a
transition's events (`packages/common/src/metamodel/refs.ts`), statechart
rules in
`packages/common/src/metamodel/statechart.ts` and statechart notation on the
canvas (ADR "State machines as nested states"). Still open:

1. **No statechart layout.** Smart Layout treats a machine like any C4
   container: cycles and long `event [guard] / actions` labels are not
   ranked for, and events float among the states. A layered left-to-right
   layout with back edges, and events kept apart (a column, or out of the
   machine), would read better. Measure with ≥5 seeds as usual.
2. **Leaf states are stored at their expanded size.** A new state gets the
   type's 320×220 and is drawn at the collapsed 170×72 while it has no
   children; Smart Layout over MCP leaves gaps sized for the stored box.
3. **Arrows stop at the final state's box,** not at its bullseye.
4. **Deleting a node leaves references to it dangling.** Transitions point
   at events by id (reference properties, ADR "Properties can reference
   nodes"), so a rename is safe, but deleting an event leaves its id in
   `event` / `raises`: a warning in the metamodel editor's Validation list and a marked entry in the picker
   until someone removes it. The store and the model facade could drop
   such ids in the same undo step as the delete.
5. **Next steps of the plan:** playing a scenario as a sequence of
   transitions, and SCXML / XState export. The Radical Forge stage is done
   (State machines, between scenarios and mockups, into one shared States
   view rather than one view per machine); it is measured only by its
   prompt tests, not yet on real briefs with a model.
6. **Studio has no Issues panel outside the metamodel editor.** Statechart
   warnings show only under *Validation* there (and from the MCP server); a
   badge in the toolbar or on the machine itself would make them visible
   while you build.
7. **Studio builds with terser** because Vite 5's bundled es-module-lexer
   misreads a minified variable named `of` (ADR "Terser minifies Studio").
   Drop `apps/studio/rendererMinify.ts` when Vite bundles es-module-lexer 3.

### Domain model (2026-10-09)

Radical Forge has a Domain model stage right after the requirements: `domain`
(bounded contexts) and `entity` nodes, aggregates (`part-of`), references
between aggregates (`references`, with a cardinality) and the context map
(`depends-on`, `partnership`), filed into a Domain view and, for now,
Conceptual too. Aggregate rules are in
`packages/common/src/metamodel/domainModel.ts`. Still open:

1. **Conceptual still gets the domain model.** The owner asked for it for
   now; drop `conceptual` from `domain` / `entity` in `VIEW_OF_TYPE`
   (`packages/common/src/ai/forge/views.ts`) once the Domain view is enough.
2. **No attributes or value objects.** An entity's fields and the values it
   holds live only in its description; a typed attribute list (and value
   objects as their own type) would let mockups and C4 use them.
3. **No Hub concepts for the stage.** The catalogue has no domain models to
   offer as prior art (e-commerce order, booking, …).
4. **No layout of its own.** Smart Layout treats domains as containers and
   entities as cards; an aggregate could be kept together, its root first.
5. **The Forge step bar is full.** Nine steps fit on one line at the modal's
   width only with short labels (Fitness, C4) and tight pills; an eighth
   stage needs a different layout (two rows of stages, or numbers).

### Agent Forge runs in Studio (2026-10-09)

The MCP server writes where an agent's Radical Forge run stands to
`.radical/forge-run.json` after every forge_* step (and `closed` when its
client goes away); Studio polls it every 2 s for the open md-folder model,
pulses the Forge button (blue working, amber waiting for the user) and opens
a read-only view with the wizard's step bar. Still open:

1. **Read only.** The user answers the agent in its chat; answering its
   clarifying questions from Studio would need a channel back (Studio writes
   answers, forge_generate reads them) and a rule for who wins.
2. **One run per folder.** Two MCP servers on one folder (Desktop and Claude
   Code) overwrite each other's status; the last writer wins.
3. **A crash shows only after 30 minutes.** A killed server cannot mark its
   run closed, so Studio shows it running until FORGE_RUN_STALE_MS passes.
4. **Polling.** Studio reads the file every 2 s while a folder model is open,
   whether or not an agent is connected; the folder watcher's change events
   could drive it instead.

