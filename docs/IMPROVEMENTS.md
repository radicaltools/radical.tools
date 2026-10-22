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
31. **A drop's push depends on the zoom** (2026-10-22) — in `physics.spec.ts` › "a drop onto a node pushes that node clear and nothing else", the same drop (offset by the nodes' size) pushes only `n7_8` on a canvas 1020 px wide but `n8_8` too at the zoom a 976 px canvas fits the grid at (the activity rail took 44 px). The test now widens the window by the rail's 44 px; a drop should push the same nodes at any zoom.

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
8. **The sample's generator is behind its JSON.** `fintechSampleData.json`
   was edited after `apps/studio/tools/generate-sample.js` last wrote it:
   the needs and their `derives` links, the layers as groups instead of
   domains, and the process *Send a payment* with its views (2026-10-18)
   are only in the JSON. Running the generator drops them and moves every
   element, which changes every figure in the manual. Either bring the
   generator up to date (and make its ELK layout match the current one) or
   retire it and treat the JSON as the source.

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
4. ~~**The Quick Search bar covers Undo/Redo** in the toolbar on canvas views at
   1440 px width.~~ Fixed: Fit All, zoom and Smart Layout moved onto the canvas
   (CanvasControls), which leaves the toolbar room; the test in
   `known-issues.spec.ts` is a guard now.
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
   The first was made on 2026-10-20 (item 102): `move_node` places a node
   it would leave outside the frame inside its new parent and refits it.
   Still open: the score.
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
    `switch_folder` tool) would let one server reach either. Again on
    2026-10-22 (Radical Crucible): another session had checked out its own
    branch in the main checkout, so the server there wrote to that branch's
    model, and the model change went in through a stdio client of the
    worktree's server.
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
24. **Amending an ADR means sending its whole text back.** An amendment is
    a paragraph added to `consequences`, but `update_node` replaces the
    property: recording runs 13 to 24 (2026-10-14) meant reading "A laid-out
    diagram stands" (about 4 000 characters) and sending all of it back with
    one paragraph more, four times over. One slip drops an earlier
    amendment without a word. An append mode for text properties, or an
    `amend_decision` tool that adds a dated paragraph, would do.
25. **`search_model` cannot answer "which X has no Y".** Finding the
    requirements no scenario verifies took a script over `relations.json`;
    the query language lists nodes and relations but cannot negate a
    relation. `radical check` (2026-10-14) now answers these for the fixed
    rules; a `WHERE NOT ... ` over relations would let a project write its
    own.
26. **An agent could not open what someone folded.** A group folded on the
    model in Studio stays folded in every new view, and no tool could open
    it in a view: rebuilding the views of `architecture/` (2026-10-14) gave
    C4 views showing one folded "Logical & physical" box, and smart_layout
    answered "the current layout already scores best" for them. update_view
    now takes `expand` and `collapse`. smart_layout could still say why it
    finds nothing to arrange (everything folded) instead of "already best".
27. **No order for views, nor a folder for them.** With 26 views in
    `architecture/` (2026-10-14) the flat list of views was hard to read,
    and neither Studio nor an agent could change the order of views. Views
    now have a `folder` path (Studio: the view's properties; folder
    properties rename a folder and move it up or down), and MCP has
    `order_views`. Still missing: ordering views inside a folder in Studio
    (drag and drop, or Move up/down in a view's properties), and a tool
    to rename a folder in one call.
28. **Calibrate Smart Layout's ranking on the author's judgement.** Since
    2026-10-15 the ranking sums standardised criteria with equal weights
    (Huang, Huang & Lin 2016) and the score sees every line the canvas
    draws. On the "Shared packages" view the author's own arrangement, which
    they find clearly better, loses to layouts with far fewer crossings (19
    against 63) that read worse: elements strung along a diagonal, long
    lines across the view. Equal weights are the paper's untested
    assumption. Plan: render 4–6 layouts of a few views (Shared packages,
    System context, Containers, a blueprint, a pattern), have the author
    rank them, fit the criterion weights to the ranking and keep the
    judgements as a test (ranking.test.ts › a view arranged by hand is
    skipped until then).
29. **A running MCP server does not say it is out of date.** On 2026-10-15
    the `radical-architecture` server Claude Code had open was built before
    #194: its `upsert_node_type` still offered `tableTab` and had no
    `summary`, so the fitness-function summary template of `architecture/`
    had to be written into `metamodel.json` by hand. The server could
    compare its build with the workspace sources (or the catalogue's tool
    schema) and say so in `get_model_summary`.
30. **`GET VIEW` of a large view is too big to read.** On 2026-10-16, to
    see whether new requirements showed in the Modelling table (221 elements
    by its chain), `search_model` `GET VIEW` returned 257 KB on one line: every
    element in full with every relation. A `GET VIEW … IDS` (or a count with
    the element ids only), or `LIST NODES IN VIEW <id> WHERE …`, would answer
    "does this view show X" in a line.
31. **Smart Layout traded overdraws for crossings on the Domain map.** On
    2026-10-16 the views of `architecture/` were rebuilt from the built-in
    viewpoints over MCP. On the Domain map (10 domains, every relation
    between them) Smart Layout went from 114 crossings and 0 overdraws to 27
    crossings and 14 overdraws: a line drawn over a domain reads worse than a
    crossing, so the ranking may weigh overdraws too lightly on nested
    domains. Worth a look with the ranking calibration.
32. **A flaky e2e test: the metamodel diagram's camera.** `metamodel-diagram.spec.ts
    › selecting a type shows its rules` failed twice on 2026-10-16 in a full
    local run (the camera came back to zoom 0.378 instead of 0.361, checked
    to 0.005), and passed 25 times out of 25 on its own and under load. The
    pane click that restores the camera may land while the fit to the
    selection still moves it; waiting for the camera to rest before the
    click would make it steady.
33. **Renaming a test means hunting the scenarios that name it.** On
    2026-10-16 eight e2e tests were renamed or moved onto other views (All
    elements became a table). The scenarios and fitness functions naming them
    were found with `LIST NODES WHERE tests ~ "…"` one title at a time and
    each `tests` rewritten whole. A tool that renames a test id across the
    model (`rename_test from to`), or `radical check` suggesting the closest
    existing title for a missing one, would make this one call.
34. **`delete_node` leaves the element's positions behind.** On 2026-10-16
    an empty "New State Machine" was deleted from `architecture/` over MCP:
    its file and relation went, but five views (Domain map, Domain model,
    System context, Containers, Components) and `_layout.json` still hold a
    position for its id. `add_node` also gives a new element a position in
    every structure view, listed there or not. Deleting should drop the id
    from every view's positions, and adding should place it only where it
    is drawn.

35. **No tool for check.json.** Setting goals for `architecture/` on
    2026-10-16 meant editing `architecture/check.json` by hand: the MCP
    server can read and change the model but not its check settings, nor run
    the check. Tools `get_check` (the result with its metrics) and
    `set_check_config` (with the loosening warnings of compareCheckConfig)
    would let an agent keep the gate the way Studio's Settings do.
36. ~~**An agent cannot see what changed in the model.**~~ Added on
    2026-10-16: `get_changes` (MCP) and `radical diff` list the elements and
    relations changed since the model's version in git, layout left out (the
    raw diff of PR #203 was some 540 moved elements around 16 changed
    fields). Studio shows the same changes since 2026-10-16 (Changes on
    branch, from `.radical/base.json` that `get_changes`, `radical diff
    --save-base` and `radical hooks install` keep). Still open: changes to
    views, the metamodel and sequences are not listed; table and wiki views
    do not mark the changed rows; `radical hooks` has no `uninstall`; a
    model with many thousand elements would want a base that holds only what
    differs; and the running `radical-architecture` server offers new tools
    only after a rebuild and a restart of the client.
37. **A flaky e2e test: the first one of a full run.** On 2026-10-18 it
    waits for Customer itself to rest (the live layout still placed it after
    the camera stopped), not only the camera, but in a full local run it
    still fails, now later: after the drag of Payment Provider the pin is
    missing (it did on a clean main too, the same day). Under load the drag
    seems to end before React Flow takes it as one. `alignment.spec.ts ›
    a row on a canvas of the whole model holds through a drag, Smart Layout
    and a reload` failed in two of three full local runs on 2026-10-16, each
    time as the run's first test: after the click on the empty canvas that
    brings the camera back, Customer lay under the left panel and the click
    on it timed out. It passed 3 of 3 on its own and 6 of 6 with six workers.
    Waiting for the camera to rest after that click (as for item 32) would
    make it steady. On 2026-10-19, with the machine busy (load average 7-10),
    three full runs in a row failed it, once with `a collapsed container
    aligns its children…` too (the click on the collapsed Bookstore did not
    select it), and `metamodel-diagram.spec.ts › selecting a type shows its
    rules` failed with the overview's zoom not yet settled (0.46 for 0.37);
    a full run on a clean main failed the same two. Alone, 28 of 28 passed.
    Later on 2026-10-19 it failed alone too: with `--repeat-each=4` two of
    four failed on a clean main (the pin missing after the drag, and the
    click on Customer under the left panel), as on feat/viewpoint-subjects.
38. **`search_model` cannot pick the fields it returns.** Looking up the
    Radical Forge elements of `architecture/` (2026-10-19) with
    `LIST NODES WHERE label ~ "forge" OR description ~ "forge"` returned
    67 000 characters for 71 rows, because every row carries the full
    description and properties of a component; the ids, types and labels
    were all that was needed, and the result had to be cut up with a
    script. A field list (`LIST NODES id, type, label WHERE …`) or a
    compact mode would do. Again on 2026-10-22: the Hub elements, 54 000
    characters for 56 rows.
39. **`update_node` cannot clear a property.** Turning the requirement "No
    refinement without asking" from event-driven into unwanted-behaviour
    (2026-10-19) needed its `trigger` gone: `null` is refused ("must be a
    string") and `""` leaves `trigger: ""` in the file. `null` should remove
    the key, as it does for `parentId` in `move_node`. (The flaky first test
    of item 37 failed again that day in a full run, and passed 3 of 3 alone.)
40. **An agent cannot take back a Smart Layout.** Reviewing the views of
    `architecture/` (2026-10-19), `smart_layout` on System context kept 0
    crossings but went from 0 to 3 overdraws (item 31 again), and no tool
    puts a view's previous positions back: Studio has Undo, an agent has to
    restore views.json from git by hand. `smart_layout` could refuse a
    result worse on any count, or a `restore_layout` could take a view's
    positions from git or from before the last call.
41. **`get_changes` is too long for the agent that asked for it.** On the
    product-version branch (2026-10-20: 14 elements added, 10 changed, 28
    relations) it returned 72 000 characters, past what Claude Code takes
    from one tool call, so the list landed in a file to read in pieces. Most
    of it was the old and new text of eight long component descriptions
    that each gained one sentence. The words changed (as Studio's card
    shows them) instead of both whole values, or a summary mode with
    `get_changes` for one element on request, would do. Item 24 again too:
    adding that sentence meant sending each description (up to 3 000
    characters) back whole.
42. **`GET NODE` of a group returns everything in it.** Checking which
    element the id 4f7ff47a… is (2026-10-22, the Decisions group) returned
    179 000 characters on one line: the group, then every ADR and fitness
    function inside it with all its fields. Asking for one node should
    return that node, with its children as ids and labels at most
    (`GET CHILDREN OF` is there for the rest).
43. **Ids must be given whole.** `search_model` rows are long UUIDs, and a
    short prefix (`GET CHILDREN OF 6d7250bb`) answers "Unknown node id"
    instead of the one element it names, as git does with commit
    prefixes. An agent has to keep every full id it has seen, or search
    again.
44. ~~**`radical explore verify` serves Studio only.**~~ Run 172 (2026-10-22)
    tested concern packs against the round's Hub on its second port; verify
    started Studio alone, so every script failed on `hub/index.json` until
    the Hub was served by hand. `explore.serve` could take a list of
    servers, each on one of the run's ports.
    Fixed 2026-10-22: `explore.serve` takes a list of servers, each on the
    run's port it names (`"port": "hub"`); `verify` starts them all and stops
    them all, and each run's prompt gives every command. `crucible.json`
    serves the Hub from the round's build on the second port.
45. ~~**A recorded finding's script still points into the round's worktree.**~~
    Most scripts of round 170–175 name `/Volumes/…/rd-cli/.crucible/…` or a
    port, so a copy under `crucible/findings/F-NNNN/` runs only where the
    round ran. Run 174's helpers find the repository by walking up; the
    round brief could ask every run to do so, and `record` could warn about
    absolute paths. `record` also drops the screenshot a finding names
    (F-0007).
    Fixed 2026-10-22: the round's brief (and `docs/EXPLORATORY-TESTING.md`)
    asks that scripts name no absolute path, finding the repository by
    walking up to `crucible.json` and taking ports and the round's folder as
    arguments; `record` warns about each copied script or helper that names
    the repository's or the round's absolute paths, with its line, and
    copies the screenshot a finding names beside its script (F-0007).
46. **`radical harden --gate` cannot judge an e2e test.** In the fix round of
    round 170–175 (2026-10-22) every group with an e2e test found the same:
    the gate sets the source files back but Playwright serves the web build
    made before, so the test "without the fix" runs the fixed bundle and
    passes. Five groups wrote their own runner that rebuilds `build:web`
    when the sources differ and keeps one preview server for the parallel
    stage. That stage fails on its own too: five Playwright processes start
    the webServer on the same fixed ports ("Port 4311 is already in use"),
    and the first to end stops the server the others use; one process with
    `--repeat-each 5 --workers 5` works. A runner in `crucible.json` could
    name a build step run before each stage, and the parallel stage could
    use the runner's own repeat option. One such wrapper also hung the gate
    by keeping its pipe open from background subshells.
47. **`radical harden --test "<file> › <describe> › <name>"` finds no Vitest
    test.** The gate passes the whole title to Vitest's `-t`, which matches
    the test's own name, not the describe path that `radical check` and the
    scenarios use; only the bare name works, so the id the gate prints is
    not the one a scenario names.

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
3. ~~**A calm drop pushes rigidly and greedily.**~~ Each covered element moves
   whole along its axis of least overlap; it never chooses a direction with
   more room, and after `CALM_MAX_PUSHES` pushes a dense spot keeps its
   overlaps. Pinned elements are pushed too and stay pinned where they land
   (`fix/drop-on-pinned`, 2026-10-09: an overlap with one used to stay, which
   read as the physics switching off). One held by lines on both axes (a grid
   cell) is never pushed: the dropped element moves off it instead, and stays
   on it when lines hold that one on both axes too.
   Fixed 2026-10-21 (exploratory runs 65 to 69): a push moves what is
   covered past the far edge of what covers it, an element pushed onto the
   dropped one moves off it again, and what is still covered when the pushes
   run out goes below the rest of its level: a drop leaves nothing
   overlapping. It still never chooses a direction with more room.
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
   server does not (a guess). Run 34 (2026-10-20, 2007738): the same
   winner on all 8 views compared, identical positions on 3 (sample Core
   Banking and Screen Map, SaaS Mockups), and up to 326 to 1 420 px apart
   on the other 5 (SaaS Containers: the server reports "overdraws 1 -> 0"
   on Studio's best). Run 28 found the positions identical on four views
   of a generated model and the injury model.
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

**Runs 7 to 12, 2026-10-14, commit 879ea0e** (PR #179), six at the same
time, each in its own areas. All 19 were fixed on 2026-10-14, each with a test
that fails without the fix; the "To decide" list is still open.

*Run 7.* Covered: F5 from Designer with the saved document checked on
every slide, reloads and a closed tab while playing, all twelve sample
slides played, card previews of every view kind, several presentations
(new, rename, switch, delete), deep links, a reload in Presenter. Not
covered: re-capturing a slide, the Link milestone and Link view pickers,
the diff toggle next to slides, copy to clipboard, folder-backed
presentations, the MCP presentation tools.

40. ~~**F5 in Designer saves the slide on screen as the live model.**~~ While
    the sample's slide 12 (linked to milestone v1) plays, the saved
    document has 11 elements and 5 relations instead of 65 and 109; a
    reload or a closed tab then keeps them (54 elements gone, Undo
    disabled). Without a reload, Esc puts the model back. A presentation
    started by F5 keeps `appMode` at `designer`, so autosave saves what
    `goToSlide` swapped into the store; `__prePresState` lives in memory
    only (a guess).
    Fixed 2026-10-14: While a presentation plays nothing is saved
    (autosave skips while `presentationActive`); what was edited before
    is saved when it stops.
41. ~~**A canvas slide shown right after a flow, table, matrix or wiki slide
    loses its camera, with about 200 console errors.**~~ Slide 3 after → ←:
    `translate(428.9, 87.3) scale(0.554)` instead of the captured (64, 14,
    0.55), and errors like `<circle> attribute cx: Expected length, "NaN"`;
    the twelve sample slides played in a row give 629. The same switch
    through view cards in Designer or Viewer gives none. `goToSlide` and
    `previewSlide` set the camera while the canvas is still mounting (a
    guess).
    Fixed 2026-10-14: A slide's camera waits for the canvas
    (`__rfPendingCamera`, taken by Canvas when it is ready), and a
    canvas takes its camera functions off `window` when it goes.
42. ~~**Adding a slide in Presenter takes back the layout edits made in
    Designer on the view that was open.**~~ A drag in System Context saved at
    y 409.7 is saved back at y 120 by the slide's save (the elements it
    pushed go back too, three positions are dropped, the view's camera
    changes), and a reload shows the old layout. `buildPersistData` writes
    the views `setAppMode` parked, which lack the positions and camera of
    the canvas shown that `saveDiagram` only adds when it saves.
    Fixed 2026-10-14: Leaving Designer puts the canvas's positions and
    camera into its view (or All elements) before setting them aside.

*Run 8.* Covered: Alt-drag connect (new pair, duplicate pair, Esc), the
connect key through a reload, deleting with relations and the undo chain,
edge labels and rolled-up edges, matrix clicks, MCP `add_relation` (a
duplicate pair, a self relation, a child to its own parent, the
properties bag, `get_issues`, a restart). Not covered: changing a
relation's type or label next to undo or milestones, hidden relations
next to undo, the wiki's "Add relationship" and the table's Relations tab
in the browser, label placement at zoom.

43. ~~**A second relation between the same two elements is never drawn, and
    its label shows nowhere.**~~ Alt-drag Customer → Web App next to "browses
    and orders": the document has 5 relations, the canvas 4 edges, and the
    new relation cannot be selected, edited or deleted on any canvas; each
    further drag adds another. A second relation added through the MCP
    server is invisible the same way (two transitions between two states on
    different events too). `deriveRFEdges` skips a second relation with the
    same visible ends and appends its label to `existing.label`, which the
    edge does not render.
    Fixed 2026-10-14: Each relation between two elements is an edge of
    its own; relations rolled up onto a collapsed container share one
    edge whose label lists them all.
44. ~~**Deleting elements with the Delete key leaves undo steps that do
    nothing, then gives the elements back one at a time.**~~ Web App and
    Orders DB deleted: three Undos change nothing, the fourth brings one
    element back, the fifth the other. `resolvePendingDelete` removes each
    node (with its relations) and then each relation React Flow added to
    the delete, every call with its own step.
    Fixed 2026-10-14: The delete is one undo step, and relations gone
    with their elements are not deleted again.
45. ~~**One click on a filled matrix cell deletes the relation when it was
    selected on another view.**~~ Select API Gateway → Payments Service on
    Core Banking, open Dependency Matrix, click the cell once: 109 → 108
    relations. The matrix removes on a click when `selectedEdgeId` is the
    cell's relation, and a view switch keeps the selection.
    Fixed 2026-10-14: A second click removes only when the first was
    made on that cell in the matrix.
46. ~~**MCP `add_relation` takes `sourceId`, `targetId` and `relationType`
    from `properties`.**~~ `properties: {targetId: "ghost-node"}` creates a
    relation to nothing, `{relationType: "nonexistent-type"}` one of an
    unknown type (refused as a top-level argument); `get_issues` reports
    neither. The properties bag is spread into the relation without checks
    (`relationTools.ts`).
    Fixed 2026-10-14: The untyped properties bag drops `id`, `sourceId`,
    `targetId`, `relationType`, `label` and `technology` with a note;
    the validation lists a relation to no element and one of an unknown
    type.

*Run 9.* Covered: flow views (repeated steps, notes, removal, a deleted
sequence and its undo), flow views next to milestones (ghost steps), a
`.radical` file round trip, a folder round trip and which files each
action writes, Structurizr DSL import. Not covered: export of the
scenarios (needs an AI provider), moving a file-backed model to a folder,
the desktop `--file` reload, ghost steps of a relation that appears twice.

47. ~~**Removing one copy of a step that appears twice leaves it listed, and
    removing it again deletes another step.**~~ Bookstore, Place Order: add
    "calls" again as step 5, remove step 2: the model holds 4 steps, the
    list shows 5 rows numbered 1, 2, 2, 3, 4; Remove on the stale row
    deletes "API → Orders DB". Both step lists in `RightPanel.tsx` key the
    rows by relation id, which repeats (the flow view keys by
    `${relationId}-${idx}`).
    Fixed 2026-10-14: The rows are keyed by relation and place.
48. ~~**A custom property whose key has a space, a dot or a non-ASCII letter
    is lost in a folder model.**~~ `SLA target: "99.9%"` is written to the
    element's `.md`; after a reload the field is empty and the next save
    removes the line (`właściciel`, `owner.email` the same; `slaTarget`
    survives). `parseMarkdown` reads only keys matching
    `[A-Za-z0-9_-]+` and skips the rest. The MCP server reads folders the
    same way (not run).
    Fixed 2026-10-14: A key the reader cannot take bare is written
    JSON-quoted, and quoted keys are read.
49. ~~**Structurizr DSL import drops everything after the first `https://`.**~~
    One `url "https://shop.example.com"` line gives "2 nodes · 0
    relations" instead of 6 and 4, with no message. `tokenize` strips
    `//` comments before tokenising, also inside strings. In the same
    importer, two relationships between the same pair keep only the first,
    and a relationship with an implied source inside an element's block is
    dropped, both silently.
    Fixed 2026-10-14: Comments are skipped as the tokenizer meets them,
    outside strings; two relationships between a pair that say different
    things are both kept; `-> target` inside an element's block has the
    element as its source.

*Run 10.* Covered: Hub import into an existing model (menu and `?hub=`
links, on a view and on All elements, related concepts, template form,
undo, reload), Studio's validation against `get_issues` on a model
breaking 21 rules (the same 21), palette drops of state, domain and UX
types, compound states on a view, the fitness function and mockup
wizards, mockups without AI, the Hub catalogue. Not covered: blueprint
import from Studio, import into a selected container, import with a
milestone shown or in Viewer, the same concept twice, the Hub's concept
viewer.

50. ~~**A concept imported from the Hub is dropped on top of the diagram.**~~
    Three requirements added from a `?hub=` link land at exactly 904,308,
    on each other and over Payment Provider (6 overlaps); the API Gateway
    pattern on the sample's System Context makes 7, still there after a
    reload. `handleImport` in `HubImportModal.tsx` centres each concept on
    the camera's centre without looking at what is there (a guess).
    Fixed 2026-10-14: Each concept goes to the free spot nearest the
    camera's centre (`freeSpotNear`).
51. ~~**One Undo after "Import (3)" leaves the related concepts in the
    model.**~~ 9 elements, 12 after importing a concept with two related
    ones, 11 after one Undo; it takes three. Each concept is imported by
    its own `handleImport`, each with an undo step.
    Fixed 2026-10-14: Everything one "Add to Model" brings in is one
    undo step (`_mergeStepsSince`).
52. ~~**"While in state" changes nothing when the requirement has a
    precondition text, which the wizard's own Sentence step writes.**~~ The
    card keeps "While the order is confirmed…" and does not follow a rename
    of the state; with the text emptied it reads "While the Order is
    Confirmed" and follows. `composeEarsSentence` takes `precondition ||
    statePrecondition`, while the preset says the state takes the place of
    the text.
    Fixed 2026-10-14: The state takes the place of the text, as the
    metamodel and the manual say (`composeEarsSentence`).

*Run 11.* Covered: Smart Layout run two and three times with undo
(bookstore, the sample's All elements and five views, generated models
of 195 and 234 nodes), alignments, grids and "Align children" next to
undo, redo, view switches, reloads and Smart Layout, pins and push drags,
collapse next to aligned children, Tree Layout per view, the camera, MCP
`smart_layout`, `grid_nodes` and `align_nodes` shown in Studio. Not
covered: layouts with a milestone shown or in Viewer and Presenter,
"Unpin all", several hundred elements, Smart Layout interrupted by an add
or a reload.

56. ~~**Smart Layout on the sample's All elements never says the layout
    already scores best.**~~ Every rerun reports "crossings 202 → 201 (0%
    better)", moves none of the 65 elements, and leaves an undo step that
    does nothing; the MCP server reports the same and writes nothing. The
    winner is scored with container frames that the parent refit
    (`resizeParentsBottomUp`) replaces when it is applied (`sys-core`
    87.6 px taller, `dom-banking` 44 px narrower), so what is saved scores
    202. Measured outside the browser; the relaxed candidate is a guess.
    Fixed 2026-10-14: The relaxed candidate's container frames are
    fitted to their children before it is scored, as applying it does.
57. ~~**Tree Layout puts sibling groups on top of each other.**~~ Core
    Banking: Access & Security over Risk & Data by 150×500 px (also on
    Payments Domain), through reruns and reloads. ELK's tree output has no
    overlap; the parent refit widens a group, and `runTreeLayout`
    separates root siblings only. A second Tree Layout also leaves an
    empty undo step.
    Fixed 2026-10-14: The tree layout parts siblings level by level
    before fitting their parent (`fitAndSeparateBottomUp`).
58. ~~**The MCP server's `smart_layout` ignores a view's "Hierarchical
    nested tree" setting.**~~ On bookstore Containers the server's Layered
    LR moves all 6 elements, and Studio's Tree Layout puts them back (23 of
    23 on the sample's Requirements Traceability). Studio's
    `runSmartLayout` hands a tree view to `runTreeLayout`; the server
    always runs `runSmartLayoutCore`, and `create_view` / `update_view`
    cannot set the mode.
    Fixed 2026-10-14: The server lays out a view whose mode is "tree"
    with the same tree layout and refit as Studio, and says so; the
    tool's description says it too.

*Run 12* (what PR #179 changed, next to its neighbours). Covered: the
property key field (add, remove, Enter, Escape, reserved keys), placement
of elements a canvas has no position for (views, reload), Restore to live
with undo, redo and reload, folder models with conflict markers in node
files and hand-written node files. Not covered: undo chains across a
sequence edit, a view switch and a milestone; collapse inside a grid or
alignment; Restore to live in a folder model; the MCP server on these
folders.

53. ~~**"Add property" makes a second property with a key another one
    already has.**~~ Add, Add, remove `prop4`, Add: the keys are `…, prop5,
    prop5`, the validation shows nothing, and the two fields in the
    properties panel edit one value. `upsert_node_type` refuses the same
    list. `add` names the property `prop${properties.length + 1}`.
    Fixed 2026-10-14: A new property gets a key no other has, and the
    validation lists two properties with one key.
54. ~~**In a folder model, an element whose `.md` cannot be read disappears
    without a word, the next edit drops its layout, and once the file is
    fixed it comes back 0×0.**~~ Conflict markers around `orders-db.md`:
    "5 nodes", no notice; a drag removes `db` from `_layout.json` and the
    view's positions; after the fix Orders DB is 0×0 and not drawn, with
    `console.error <ellipse> rx -2`. `deserializeFromMdFolder` skips a file
    with no `id`/`type`; item 35 covered only the JSON files.
    Fixed 2026-10-14: A node file with git conflict markers is a
    `MalformedFolderFileError` that names it; Studio says so and saves
    nothing until it reads again (as for the JSON files).
55. ~~**An element added as a `.md` file by hand (or by git) is drawn and
    saved at 0×0.**~~ A database and a person written by hand are drawn with
    no size on every canvas and saved as `width 0, height 0`, with the same
    console error. An element missing from `_layout.json` reads as
    `{x:0, y:0, width:0, height:0}`, and `placeUnplaced` sets only its
    place.
    Fixed 2026-10-14: A node the layout does not know gets its type's
    size (from the stored metamodel, else the C4 sizes).

To decide (runs 7 to 12): after a reload in Presenter, Designer opens on
All elements, and the presentation picker on the first presentation;
Shift-click on an edge replaces the selection; the connect key goes back
to Alt after a reload; the MCP server accepts a self relation and a
relation from a child to its own parent, which Studio's gesture refuses
without a word; Open → File… opens a model on All elements, not the view
it was saved on; opening a flow or table view writes the positions of the
canvas left under that view; a ghost step keeps its old number; Restore
to live on a view uses the milestone's coordinates and leaves the camera
where it was; Redo lands on the canvas Undo was pressed on; with Smart fit
on, a reload refits the camera instead of keeping the user's zoom and pan
(rule 1 names the camera); a ⌘ drag onto a pinned element leaves the two
overlapping; changing a view's auto-layout mode is not an undo step;
related concepts imported from the Hub have no template record, and
Cancel on the template form leaves them imported; Hub filters change the
address without a history entry and the search text is lost on reload.

**Runs 13 to 24, 2026-10-14, commit 2825bee**, twelve at the same time,
each in its own areas. All 36 were fixed on 2026-10-14, each with a test
that fails without the fix; the "To decide" list is still open.

*Run 13.* Covered: writing the model in the wiki (EARS sentences written
and rewritten, with and without a state; two containers written with undo
and redo; a pasted list of three lines; the result on Containers and All
elements; reloads 2 s and 5 s after a write), group pages, a delete from
the wiki on a view that lists its own elements. Not covered: page-title
renames with undo, Multi page chapters, search and glossary after
writing, links between pages, milestones, Viewer, folder models.

59. ~~**The wiki reads a requirement that points at a state by its
    precondition text, not by the state.**~~ With `precondition_state:
    confirmed` and the text "the order is waiting" (the wizard's Sentence
    step always writes one), the card reads "While the Order is Confirmed,
    …" and the wiki "While the order is waiting, …"; a rewrite in the wiki
    changes the wiki only; with no text the wiki shows the empty slot
    "While ‹precondition›". `EarsSentenceEditor` and `partSummary` call
    `composeEarsSentence` without the state; item 52 fixed the card only.
    Fixed 2026-10-14: The wiki puts the state's phrase in the "While" slot
    and in its summaries, as the card does; rewritten to another "While"
    clause, the requirement stops pointing at the state.
60. ~~**Deleting every element a view lists turns it into a view of the
    whole model.**~~ Core Banking Platform deleted from Architecture Wiki,
    which lists 14 elements under it: the overview goes from 14 to 51
    elements, the page list from 3 to 37, the Core Banking canvas draws 51.
    Both views are saved with `nodeIds: []`, which means "every node";
    `deleteNode` in `model.ts` and the store filter the list down to empty.
    Fixed 2026-10-14: A view whose list a delete or a hide empties is
    marked `empty` and shows nothing; Studio, the layout and the MCP server
    read it through `viewShowsEveryNode`.
61. ~~**After writing an element in the wiki, the first click on an "Add: …"
    link below the line does nothing.**~~ "Search Service" written as a
    container on Bookstore, then "Software systems" clicked: nothing; the
    second click works. The mouse-down blurs the line, its hint (shown only
    while focused) goes, and the link moves up 19 px before the mouse-up.
    Fixed 2026-10-14: The hint keeps its room when hidden (`visibility`),
    so nothing below it moves.

*Run 14.* Covered: the Requirements Register's 13 tabs; text cells with
Enter, Escape, Tab and click-away next to undo and redo; Viewer (inert
cells); the Relations tab's columns from a relation type's properties,
checked against the properties panel; palette drops onto a table and onto
a row. Not covered: number cells and required properties, multi-ref chips
next to undo, table edits with a milestone shown, folder models, the wiki
showing table edits.

62. ~~**A yes/no cell on the table's Relations tab does nothing when
    clicked.**~~ A boolean `urgent` on `transition`: the cell stays "—" and
    the relation is saved without it, with no notice; the properties
    panel's checkbox works. `handleBoolToggle` in `TableView.tsx` called
    `updateNode` with a relation's id.
    Fixed 2026-10-14: On the Relations tab the cell updates the relation.
63. ~~**A table enum cell with no value shows its first option as if set,
    and that option cannot be picked.**~~ Pending payment → Confirmed, Kind:
    the select opens on `external`, choosing it fires no change and `kind`
    stays unset (the State tab's Kind the same). The table's version of
    item 33, which was fixed in the properties panel only.
    Fixed 2026-10-14: An empty enum cell opens on "(not set)", so every
    option can be picked.
64. ~~**Opening a table cell and leaving it without typing makes an undo step
    that does nothing, and writes `""` into an empty property.**~~ After a
    name edit and two cells opened and left, it takes three Ctrl+Z to undo
    the edit; an empty Payload cell opened and left saves `payload: ""`.
    `commitEdit` saved on every blur, and `updateNode` / `updateRelation`
    pushed a step for a patch that changes nothing.
    Fixed 2026-10-14: A cell left as it was saves nothing, an emptied
    property is cleared instead of set to "", and an update that changes
    nothing is no undo step.

*Run 15.* Covered: hierarchy drilling (double-click, Esc, breadcrumb,
reload), drilling and Size in Viewer, deletes next to the focus with undo,
generated nested models up to 1 215 elements; the matrix's row order, an
add on an empty cell with undo and redo from another view, the two-click
remove, an add with a milestone shown. Not covered: the popup for several
relations, hidden relations next to matrix clicks, matrix refusals on the
Radical metamodel in the browser, Size and Levels next to undo, folder
models.

65. ~~**One click on a matrix cell deletes the relation when the cell was
    clicked in Viewer first.**~~ Dependency Matrix in Viewer, click API
    Gateway → Auth Service, back to Designer, click it once: "Removed
    relation", 109 → 108. `onCellClick` armed the cell in Viewer too, and
    the selection survives the switch; the class of item 45.
    Fixed 2026-10-14: A click in Viewer only selects, and a change of
    perspective disarms the cell.
66. ~~**The hierarchy's drill level is lost, and the loss is saved.**~~ A drag
    on Core Banking, Platform Hierarchy drilled into Banking Services,
    Ctrl+Z: the drag is undone and the hierarchy is back at "All", saved so
    (`_restoreHistoryEntry` restored the views with the focus they had at
    the drag). Drilled to Payments Service, milestone v1 (which lacks it)
    opened: "All", also back on the live model and after a reload (the
    "focused node was removed" effect in `TreemapView.tsx`).
    Fixed 2026-10-14: Undo leaves what each view looks at (the hierarchy's
    focus, the wiki's page, the table's tab) alone, like a camera; a model
    without the focused element shows the top without changing the view,
    which forgets its focus only when the element is deleted from the live
    model.
67. ~~**A slide added on a drilled-in hierarchy plays at the top level.**~~
    Presenter, Platform Hierarchy drilled to Banking Services, Add slide,
    Esc up to All: the slide shows "All", from its card and while playing.
    `PresentationSlide` had no field for the drill level.
    Fixed 2026-10-14: A slide of a hierarchy view keeps the element it was
    drilled into (`treemapFocusId`) and shows it while the slide is shown,
    without changing the view's own focus.

*Run 16.* Covered: Screen Map (mockups with wireframes, collapse and
expand of flow groups with undo and reload, Smart Layout), Alt-drag
connections from and to mockups, the Mockup wizard into a flow group,
Remove wireframe with undo, redo and reload in the panel and the wiki,
PNG and SVG export, a folder model, the MCP mockup tools and
`forge_wireframe`. Not covered: slides and flow playback with mockups, the
milestone diff toggle, table cells of mockups, the File System Access
picker, a blueprint imported from Studio.

68. ~~**A Hub blueprint downloaded as `.radical` opens under the C4
    metamodel.**~~ `bp-ecommerce-platform.radical` (the Hub's Download)
    opened with Open → File…: 125 validation issues such as `unknown type
    "requirement"` (83 on bp-saas-b2b-platform), no UX palette group,
    mockup → mockup refused, a mockup's panel without its fields, while the
    wireframes still draw. Blueprints carry no `metamodel`, and
    `documentMetamodel(undefined)` returned C4.
    Fixed 2026-10-14: A document without a metamodel opens under the
    Radical preset when it holds types only that preset has, in Studio and
    in the MCP server.
69. ~~**"Propagate to later milestones" carries a mockup's new label forward,
    but not its Screen / route or a removed wireframe.**~~ Screen Map in v4:
    route `/accounts` → `/accounts/v2`, Remove wireframe, label + " X",
    Propagate: v5 and the live model get the label only. The diff in
    `commitMilestoneChanges` compared a fixed list of fields (for relations
    the ends, label and technology).
    Fixed 2026-10-14: Propagate carries every field of an element and of a
    relation forward, metamodel properties and relation types included.

*Run 17.* Covered: the ADR and Requirement wizards from the canvas
(Ctrl+Enter from the first and the relations step; Ctrl+Z, F5 and
Backspace with the focus on a chip), drops on collapsed containers, a
state machine built by hand (palette drops, Alt-drag transitions and
emits, the validation's warnings), compound states with collapse, expand
and reload. Not covered: Back and Cancel in a wizard; the need, scenario,
fitness function and mockup wizards; wizards from the table and the wiki;
"Fill in with wizard…"; editing a transition's fields; parallel, history
and final states.

70. ~~**Ctrl+Z inside a wizard undoes the model behind it, and Create then
    saves a model that cannot be opened again.**~~ A Software System
    dropped, an ADR dropped into it, a status chip clicked, Ctrl+Z: the
    system goes while the wizard stays open; Ctrl+Enter saves the ADR with
    a `parentId` that is gone, and Studio shows "Runtime Error: Parent node
    … not found", after a reload too (5 of 5). F5 in the wizard started the
    presentation behind it and the ADR was lost. The keys on `window` in
    `Toolbar.tsx` did not check for a wizard, and `checkAddNode` took a
    missing parent for the root.
    Fixed 2026-10-14: Ctrl/Cmd+Z and F5 leave the model alone while a
    wizard or another modal dialog is open; an element added into one that
    no longer exists is refused; a child whose parent is missing is drawn
    without one, so such a model opens.
71. ~~**An ADR or requirement dropped on a collapsed container through the
    wizard lands on its header, over a sibling.**~~ Bookstore collapsed and
    dragged, an ADR dropped on it and created, Bookstore expanded: the ADR
    is at (49, 81), over Web App by 180×13 (a requirement by 200×27). Item
    39 again: `_createNodeWithLinks` lacked `addNode`'s branch for a
    collapsed parent.
    Fixed 2026-10-14: The wizard places its element as `addNode` does,
    beside the others in a collapsed container, below its header
    (`_placeNewChild`).
72. ~~**A state dropped into a state that has no children lies outside it,
    and a reload moves it.**~~ On order-machine's Order view a State dropped
    onto Pending payment is saved at (−76, −67), size 320×220, above and
    left of the parent's frame, which stays empty; a reload moves it
    117.5 px down. It was centred on the drop point at its stored size in a
    parent drawn at 170×72.
    Fixed 2026-10-14: A new child starts no further up or left than its
    parent's header and side padding.

*Run 18.* Covered: milestone edits on the sample (v1 to v4, on All
elements and Core Banking): a property change, a rename, deleting a leaf
and a container, Propagate, reload; the same in a folder model next to the
MCP server's milestone tools and `get_issues`. Not covered: "Save as new
milestone" and Discard after each kind of edit, undo around the choice,
reparenting, collapse, drags, alignments and sequences in a milestone, the
diff toggle, renaming and deleting milestones.

73. ~~**Propagating the delete of a container made in an early milestone
    breaks Studio for good, and a deleted element leaves its later
    relations behind.**~~ Banking Services deleted in v1 and propagated: the
    live model and v2 to v4 keep Payments Service and Event Bus under the
    deleted parent, and 4 relations to nothing; Current (live) and every
    reload show "Runtime Error: Parent node dom-banking not found". Web
    Banking deleted the same way leaves 11 relations to it in the live
    model ("107 relations", 96 edges drawn). `removedNodeIds` came from the
    edited milestone only.
    Fixed 2026-10-14: A propagated delete also removes what lies inside the
    element in each later model, and every relation left without an end.
74. ~~**Propagate does not carry a changed property to later milestones or
    the live model.**~~ ADR-001's status set to deprecated and its label
    edited in v3, then Propagate: v4 and the live model get the label and
    keep `accepted`, in a folder model too. The cause of item 69.
    Fixed 2026-10-14: With item 69.
75. ~~**Clicking an element in a milestone asks how to save changes nobody
    made.**~~ v4 opened, ADR-001 clicked once: the "Editing milestone"
    prompt opens and the chip says "unsaved", with nothing moved.
    `liveRelease` marked a milestone edit also when nothing moved.
    Fixed 2026-10-14: Only a release that moved something edits the
    milestone.

*Run 19.* Covered: opening, the hint, Smart Layout, a rerun and a reload
on seven generated models of 200 to 570 elements (6.7 to 31.3 s, each
rerun "already best", 0 overlaps); actions during Smart Layout; plain
drags and an undo chain on 215 elements; Quick Search, wiki, table, matrix
and hierarchy on 570; a folder of 575 files; the browser storage quota;
MCP `smart_layout` against Studio (0 of 215 positions differ). Not
covered: 600 elements with 1 800 relations (no output), MCP parity on
flat models, views and milestones on large models.

76. ~~**Expanding one container on a large nested model scatters elements
    across every system, never comes to rest, and a reload shows another
    picture.**~~ n3-200 (5 systems × 6 containers × 6 components), Service
    0.0 collapsed and expanded: 93 elements outside it move (57 with nothing
    in common with it, one by 1 069 px), 99 still move after 60 s, 86 to 91
    overlaps or children outside frames, and a reload moves 138 to 140
    (also on 124 elements). Each child the expand showed counted as new and
    freed the 40 elements nearest by relation, across containers whose
    frames stayed fixed.
    Fixed 2026-10-14: An expand makes room in the store (siblings parted
    level by level, a parent's frame growing left or up where a child
    reaches past it), and the physics takes the result as it is (`reset`,
    not `invalidate`); nothing else moves.
77. ~~**From 150 elements, one ⌘ drag throws about 40 elements thousands of
    pixels and leaves them on top of others.**~~ 200 root elements after
    Smart Layout, System 106 ⌘-dragged by 150×90: 40 move, the farthest by
    2 496 to 3 696 px, at rest after about 60 s or still moving at 90 s,
    with 5 to 13 overlaps left (5 of 5). `freezeAllBut` put the frozen
    nodes back each tick, so the freed ones were pulled toward far frozen
    neighbours and landed on them.
    Fixed 2026-10-14: From `WHOLE_DIAGRAM_MAX_NODES` (150) a push drag is a
    calm drag: what is held moves, and the drop clears what it lands on.
78. ~~**"This diagram is not laid out yet" after a reload of a model Smart
    Layout just arranged.**~~ n3-200 with its 30 containers collapsed,
    Smart Layout (0 violations), reload: the notice, and Smart Layout then
    says the layout already scores best (3 of 3). `looksUnarranged` used
    stored sizes, for a collapsed container its expanded one (708×410
    against 240×160 drawn), and ignored a view's collapse.
    Fixed 2026-10-14: `looksUnarranged` takes elements as drawn: collapsed
    containers at their collapsed size, what they hold skipped, with the
    active view's collapse.

*Run 20.* Covered: the metamodel tools with valid and invalid properties,
defaults, refs and deletes; `add_node`, `update_node` and `move_node`;
tempIds; views of every kind, sequences, presentations, milestones; 55
`search_model` queries; two servers on one folder and a hand edit of
`metamodel.json`; Studio opened on the folders. Not covered:
`get_selection`, the `forge_*` tools, `compare_milestones` across
milestones, a restart during a call, hand edits of node files while the
server runs, relation properties through `update_relation`.

79. ~~**The MCP server refuses a node or relation type that Studio, another
    server or a hand edit has just added, until some other tool is
    called.**~~ Server B upserts `service` and `calls` (or `metamodel.json`
    is edited by hand); server A's `add_node` with `service` fails with
    "data/type must be equal to one of the allowed values" (4 of 4). The
    SDK checks a call against the registered schema, whose lists come from
    the metamodel A saw last, before `refreshTools` runs.
    Fixed 2026-10-14: The schemas still list the types, but calls are
    checked without the lists; `add_node` and `update_node` check the type
    against the metamodel the call runs on and name the ones it has.
80. ~~**`search_model` says a view that shows every element is empty.**~~ A
    view made by `create_view` with no `nodeIds` (every node, its
    description says): `LIST VIEWS` gives 0 nodes and 0 relations, `GET
    VIEW` none, `GET NODE api` leaves the view out, while Studio draws 6
    elements and `smart_layout` lays out 6. `viewNodeSet` in
    `queryLanguage.ts` walked `view.nodeIds` only.
    Fixed 2026-10-14: A view that lists no node, and was not emptied (item
    60), shows every node to the query language too.
81. ~~**`update_presentation` accepts one slide id twice; deleting one of
    them in Presenter deletes both from the file.**~~ Slides A and B (both
    `slide-1`) and C: Delete slide on B leaves cards A and C, both numbered
    1, and `presentations.json` with C only. `parseSlides` never marked a
    kept id as used.
    Fixed 2026-10-14: A repeated slide id is refused, with a hint to leave
    the id out for a new slide.

*Run 21.* Covered: Shift, ⌘, Ctrl and Alt clicks, box select, Delete from
the selection bar and the key next to undo, Delete in Designer, Viewer,
Presenter and during F5 and with the focus in dialogs, the arrow keys, the
presenting keys, Esc in the presenter, the Delete prompt and dialogs. Not
covered: ⌘/Ctrl+P and the zoom keys, Tab order, Enter in table cells, the
wiki's writing line with Delete and Backspace, Wrap, Move to, Align and
Hide next to undo, the Shift connect key with a multiple selection.

82. ~~**The arrow keys move the selected element on screen only.**~~ Web App
    with Shift+ArrowLeft ×20 moves 400 px left, out of Bookstore, which is
    not refit; nothing is saved, Undo stays disabled, and the next drag or
    a reload puts it back. React Flow's keyboard moves reached `rfNodes`
    only.
    Fixed 2026-10-14: React Flow's keyboard moves are off
    (`disableKeyboardA11y`); the manual says to drag.
83. ~~**Delete while an F5 presentation plays hides the element from the
    view for good, while the model keeps it.**~~ Bookstore, F5, Payment
    Provider clicked, Delete, "Remove from model", Esc: the view loses
    `payments` (saved, kept on reload), the model keeps all 6 elements, and
    the step lands in Designer's undo history. In Viewer and Presenter
    Delete opened the prompt too. `deleteKeyCode` ignored the mode, and
    `stopPresentation` puts back elements and relations, not views.
    Fixed 2026-10-14: Delete removes elements and relations in Designer
    only, and not while a presentation plays, on the key and in the
    store's change handlers.
84. ~~**Dragging a child while its container is also selected moves the
    whole container on screen only, with uncaught errors.**~~ Containers:
    Bookstore clicked, Web App Shift-clicked and dragged: all four move by
    (192, 256), nothing is saved, no undo step, a reload puts them back,
    and about 24 `Cannot read properties of undefined (reading 'id')`.
    After a box select around Bookstore the same without errors, and
    Bookstore left over Payment Provider. React Flow leaves the grabbed
    node out when its parent is selected and hands the drag handlers
    `undefined`; after a box select it drags the selection's frame, whose
    handlers were not wired.
    Fixed 2026-10-14: The first element React Flow drags stands in for the
    grabbed one, and the `onSelectionDrag*` handlers take a box
    selection's drag the same way: saved, and one undo step.
85. ~~**The selection bar's Delete is one undo step per element.**~~
    Customer and Payment Provider need 2 Ctrl+Z, three containers 3,
    Bookstore and Web App 2 (the first does nothing). `onDelete` in
    `SelectionActionBar.tsx` called `removeNode` per id. Reported past the
    run's three-finding cap.
    Fixed 2026-10-14: The bar deletes through `removeNodes`, one undo step.

*Run 22.* Covered: switching models while Smart Layout runs, the sample
from Models → Open…, a browser without the File System Access API
(download and open give the same model and picture), a milestone and a
typed link with Back, Forward and reload, deleting the open model while
another exists, Create model with storage full. Not covered: Reconnect…,
folder models in two tabs, a switch within the 400 ms debounce, a switch
during a presentation, moving to a file or folder with storage full, the
Welcome screen's Recent list.

86. ~~**With two tabs on two browser models, an edit in one tab is saved
    into the other tab's model.**~~ Tab A on bookstore (`doc-a`), tab B on
    order-machine (`doc-b`), a drag in tab A: `radical-doc:doc-b` holds the
    bookstore, the order-machine model is gone, and tab A's address says
    `doc-b`. The saves and the address read the open document from the
    index every tab shares (`activeId`, the last one opened).
    Fixed 2026-10-14: Each tab keeps the document it has open; the shared
    `activeId` only says where a new tab starts.
87. ~~**Deleting the only model leaves it on screen, edits go nowhere, and a
    reload shows another model.**~~ Models → Delete… on the only model: its
    6 elements stay drawn and editable, a drag is saved nowhere, and the
    reload shows a new "Untitled" seed model of 7. `autosave.ts` returned
    on `!activeId` without loading anything.
    Fixed 2026-10-14: Deleting the last model opens a new empty one, which
    edits are saved into.
88. ~~**With browser storage full, renaming a model does nothing and says
    nothing.**~~ 50 characters left: Rename keeps the old name with only a
    `console.warn`, where saving and Create model say "Browser storage is
    full…". `writeIndex` caught the quota error.
    Fixed 2026-10-14: A rename that storage refuses says so.

*Run 23.* Covered: the Hub concept viewer (canvas, wiki, table and every
named view of four concepts; deep links from a fresh page), a blueprint
import with the element picker and the template form, the views and
sequences that come with it, the Hub template's Edit and Apply with undo,
an import into a selected container, the same concept twice. Not covered:
an import with a milestone shown or in Viewer, reloads and folder models
after an import, Add to Studio and Download in the Hub, Hub search and
filters, placement of related concepts.

89. ~~**A blueprint import leaves `{{KEY}}` placeholders in the model.**~~
    Fintech into bookstore: the form asks 3 of the blueprint's 4
    parameters, and the fitness function "Manual Adjustment Rate Guard"
    keeps "{{MAX_ADJUSTMENT_RATE_PCT}}%"; the flows' step notes keep
    `{{DISPUTE_INVESTIGATION_DAYS}}` and `{{RECONCILIATION_LAG_MIN}}` (every
    blueprint has tokens there). The picker took parameters only from nodes
    with their own `templateParams`, and only node fields were substituted
    (also by `applyTemplateParams`, the MCP Forge path).
    Fixed 2026-10-14: The form asks every parameter the chosen texts and
    flows use (`templateKeysUsed`), and the values reach nodes, relations
    and sequences, step notes included, in Studio and over MCP.
90. ~~**"Apply" in the Hub template section undoes edits to other imported
    elements, and one Undo does not take it back.**~~ Posting API renamed
    (it holds no parameter), then Apply with a new SLA: 4 elements change
    and Posting API loses its name; it takes 21 Undos to get "10 days"
    back, and the record still says 5. `reapplyTemplate` rewrote every text
    field of all 38 imported nodes, one `updateNode` and step each, and the
    record was not part of undo.
    Fixed 2026-10-14: Apply (`applyHubTemplate`) rewrites only the fields
    whose Hub text holds a parameter, as one undo step that covers the
    template's values too.
91. ~~**A concept imported into a selected container lands on the container's
    own children, and two imports land on each other.**~~ Sidecar into
    Bookstore: Service Mesh (660×640) at Bookstore's top-left, over Web
    App, API and Orders DB and out of the frame; two API Versioning ADRs
    both at (0, 320). Into a drop target, roots kept the concept's own x/y;
    `freeSpotNear` (item 50) served imports at the root only.
    Fixed 2026-10-14: An import into a selected container goes beside what
    it holds, below its header (`placeBesideSiblings`), and once the
    container has grown its neighbours make room (`resolveOverlaps`).

*Run 24.* Covered: deleting types that other types name (as an allowed
parent, in a pair, as a reference's type) in Studio and over MCP, and a new
type reusing the id; relation properties of type text, number, ref and
enum, and "req" on node and relation types; the MCP type tools' input
checks; the Diagram tab after a dangling type. Not covered: "Reads as" in
the wiki, pairs or parents changed while elements break them, cardinality,
refs switched between one and many, renaming a type, switching presets
with custom types, a custom metamodel through a file or a folder.

92. ~~**Deleting an unused element type in Studio leaves it in relation
    pairs, allowed parents and reference properties; the editor shows them
    as "Person", and the next new type takes them over.**~~ `type1` deleted:
    its pair reads "Person → Person", `allowedParents: ['type1']` and
    `refType: 'type1'` stay, the validation says 0; the next "Add node
    type" is `type1` again, and the row reads "New type 1 → Web App".
    `removeNodeType` deleted `nodeTypes[id]` only; the MCP server removed
    pairs and parents.
    Fixed 2026-10-14: Studio and the MCP server share
    `metamodelWithoutNodeType` (the type leaves allowed parents and pairs),
    and the delete is refused while a property of another type points at
    it.
93. ~~**MCP `delete_node_type` turns a relation type whose pairs all name the
    deleted type into "any pair".**~~ `issues` with the pair `badge →
    badge`, `badge` deleted: `allowedPairs: []`, which means any pair; ADR
    → Need, refused before, is accepted, and `get_issues` says "No issues".
    Fixed 2026-10-14: Deleting a type is refused, in Studio and over MCP,
    when it would leave a relation type with no pair
    (`checkRemoveNodeTypeFromMetamodel`).
94. ~~**A required property of a relation type is never checked.**~~ A
    required "Owner" on transitions: Validation 0 (3 for the same on
    states); over MCP a required `evidence` on `derives` gives "No issues".
    `validateModel` checked `required` for node types only.
    Fixed 2026-10-14: Validation and `get_issues` list a relation that
    lacks a required property. Also from this run's notes: a number
    property is a number field on relations (a text field saved "abc5")
    and on elements (emptied, it saved 0); emptied, it is cleared.

To decide (runs 13 to 24): the wiki's Delete confirmation counts direct
children only ("its 3 child elements" for 14), and the overview of a view
gives the whole model's relation count; with one model in two tabs the
tab that saves last wins, with no warning; a palette drop on a table's
last row offers "Add inside" a mockup and goes into its parent group; the
matrix creates a relation between a container and its own child, and
lists rows in model order rather than the view's; Esc and Backspace in
the hierarchy (and every Escape listener) sit on `window` with no check
for a dialog or a focused select, so one Esc closes both the Delete prompt
and the Models dialog over it; a milestone opens under the view's live
camera (Screen Map's groups off screen); a Navigates to with only a
Trigger shows its type name on the edge; a transition's Kind select has
no "(not set)"; MCP `update_node` says "Updated" when nothing changed and
cannot clear an enum, number or boolean value, `update_view` refuses even
a rename of a dynamic view `delete_sequence` unlinked, `upsert_node_type`
accepts a default its property refuses and a `refType` of no type, and
`LIST VIEWS` counts no relations on rolled-up edges; "Add relation type"
makes a type with no pairs, which allows every pair; pair min/max is
stored but read by nothing, and the editor takes a maximum cardinality
below 1; a fresh profile lists an "Untitled" model nobody made, and
"Download as file…" names the file `.c4.json`; a propagated delete
rewrites `views.json` and `_layout.json`; the milestone diff is not
recomputed after an edit.

**Runs 25 to 34, 2026-10-20, commit 2007738**, ten at the same time, each
in the areas changed since 2825bee. 33 findings, of which three were found
twice (each is listed once, under the first run, naming the other).
All 30 were fixed on 2026-10-20, each with a test that fails without the
fix; the "To decide" list is still open.

*Run 25.* Covered: view folders (set, nested, rename, Move up and down,
with undo, redo and reload; through Download as file and Open → File…; in
a folder model while the MCP server writes it); viewpoints (New view from
the C4 and Radical metamodels, Detach, Save as viewpoint with Save and
Replace, View type, undo, MCP `update_view` kind); the filter chain on the
Requirements Register (levels removed, Show every element, undo, redo,
reload, an edit while a milestone is shown); view card counts against what
is drawn, live and in a milestone. Not covered: the filter editors in
place (+ Filter, + or, Sort), a chain next to collapsed containers and
Smart Layout, folders in Viewer and Presenter, two tabs.

95. ~~**Changing a view's type is not an undo step, so Undo takes back the
    step before it.**~~ On a new view of the viewpoint Containers, View type
    → Table, then Ctrl+Z: the view is deleted (Undo took back the New
    view), and Redo brings it back as a table. Detach is a step, but a
    type change, which also detaches, is not. `setViewKind` in
    `diagramStore.ts` pushes no step.
    Fixed 2026-10-20: Changing a view's type is one undo step; Undo gives
    back the old type and the viewpoint, and Redo the new type.
96. ~~**Undo after "Save as viewpoint… → Replace" throws, and two steps are
    lost.**~~ View A of System context, view B of Containers, B detached and
    saved as "System context" (Replace): the 2nd and 3rd Ctrl+Z change
    nothing and throw `Cannot assign to read only property 'viewpoint'`,
    and the 4th removes both views. `_restoreHistoryEntry` runs
    `syncViewpoints` on the history entry's frozen views, and `undo()` has
    already popped the step.
    Fixed 2026-10-20: Undo after Save as viewpoint → Replace, or after a
    viewpoint is changed or deleted in the metamodel editor, takes back each
    step in turn, and views of the viewpoint follow it as the metamodel has
    it now.
97. ~~**A new view of a viewpoint draws its elements over each other and
    outside their containers.**~~ Bookstore, from System Context, + New view
    → Containers: Bookstore keeps its 360×260 System Context frame, and
    API and Orders DB lie outside it and over Payment Provider; on the
    sample, from Core Banking, 21 violations among 19 elements. No notice,
    and a reload keeps it; a blank view turned into Structure does the
    same. `setActiveView` keeps the outgoing canvas's positions for a view
    with none, and only a group's views get Smart Layout on first opening.
    Fixed 2026-10-20: A structure view shown for the first time starts from
    All elements' places, so its elements lie inside their containers; a
    view of a viewpoint is also laid out by Smart Layout the first time it
    opens in Designer (not in a milestone).
98. ~~**A view folder moved in Studio while an agent writes the folder model
    moves back, with no notice.**~~ Move up on folder B while the agent's
    mark holds Studio's saves, then the agent renames another view: both
    renames stay, the folders go back to A, B in Studio and `views.json`.
    `mergeById` in `modelMerge.ts` keeps theirs' order, so a reorder on our
    side is dropped and not reported.
    Fixed 2026-10-20: A reorder of views made on one side (a folder moved
    up, `order_views`) survives a merge with the other side's edits; when
    both sides reordered, the folder's order is kept and the notice says
    "order of views".

*Run 26.* Covered: the properties card and its ✕ next to selection and
view switches; Viewer (every control of the card and table: the document
stayed as it was); EARS slots and Markdown fields with Ctrl+Z in them; the
Parent field's refusals; Fit All against the card and the palette; the
palette on a 600 px window; the table's + rows on a chained register, All
elements, a blank view and a 260-row table, through wizards, with a
milestone shown, with undo and redo from another view, after a reload;
every + row choice over the sample, the fixtures and the Hub catalogue
checked against the validation. Not covered: folder models, a relation's
card, Summary in tables, Presenter.

99. ~~**After ✕, an element's properties card never opens again, even after
    another element was selected.**~~ Bookstore, System Context: Customer, ✕,
    Payment Provider (card), Customer: selected, no card; the same after a
    view switch. The manual says ✕ hides it "until you select something
    else". `RightPanel` keeps the dismissed subject (`node:<id>`) until
    another ✕.
    Fixed 2026-10-20: After ✕ the properties card opens again for that
    element once something else, or nothing, has been selected. (manual
    sentence updated)
100. ~~**The table's + row and the palette put a state inside a final state,
     which the validation then flags.**~~ order-machine, "+ State" under
     Cancelled: Validation 0 → 2 ("Final state "Cancelled" cannot contain
     other states."). A palette drop does the same, and MCP `add_node`
     accepts it with that warning. `addChoices` and `checkAddNode` follow
     allowedParents only; the rule is only in `validateStateMachines`.
     Fixed 2026-10-20: A final state holds nothing: the table offers no +
     under it, and a palette drop, a move, MCP add_node / move_node, or
     making a state that holds states final are refused, with the reason.
101. ~~**Undoing the add of the selected element leaves an empty properties
     card and "1 node selected" for an element that is gone.**~~ On a canvas
     (drop, click, Ctrl+Z), in a table (+ row, name, Ctrl+Z twice), and
     when a milestone without the selected element is opened. The empty
     card has no ✕; Hide from view on that selection makes an undo step
     that changes nothing and drops the redo of the add.
     `_restoreHistoryEntry` does not prune the selection, and
     `removeNodeFromView` pushes its step before it checks the ids.
     Fixed 2026-10-20: Undoing the add of the selected element, or opening a
     milestone without it, clears the selection and closes its card; Hide
     from view of something the view does not show is no undo step and keeps
     the redo.

*Run 27.* Covered: the Warnier view's outline edits (Enter, Tab,
Shift+Tab, Alt+Up/Down, F2, Delete, repeat and condition, a brace click)
with undo, redo and an undo from another view; the same on a folder model
with reload and a `.radical` round trip; refused moves; Viewer, Presenter
and a presented Warnier slide; milestones; Hide and Remove from model; a
canvas view switched to Warnier and back; the viewpoint Process; Quick
Search on every view type; the MCP server's process and step rules against
Studio's. Not covered: Forge's Processes stage, processes inside systems
and groups, large process trees.

102. ~~**A step indented or outdented in the Warnier view lies outside its
     new parent on the process canvas.**~~ Sample, Processes: Tab on Quote FX
     (now in Validate); on Payment Process it is drawn at its old offset
     (500, 140) read from Validate, which puts it in Approve under Hold for
     review. `reparentNodes` in `model.ts` rebases `node.x/y` only, not
     `views[].positions` of the views that draw the element, and does not
     refit the parent there. Probably the cause of Logical item 12
     (`move_node`) too.
     Fixed 2026-10-20: A moved element (Tab or Shift+Tab in Warnier, Move
     to…, MCP move_node) keeps its place on every canvas where it then lies
     inside its new parent, and is placed inside the parent, beside its
     siblings, on the others; move_node places a node it would leave outside
     the frame inside the parent and refits it.
103. ~~**In a view of one process, + Process and Enter add a process the view
     does not draw.**~~ New view → Process (a view per element): + Process,
     or Enter on Send a payment, adds "New process", which only its own new
     view draws; no name opens and what is typed is lost. `canAddProcess`
     and `insert` in `WarnierView.tsx` ignore views per element.
     Fixed 2026-10-20: A view of one process offers no + Process; Enter on
     the process adds its last step with its name open, and nothing can be
     outdented out of the process.
104. ~~**In a milestone, the first Warnier add asks how to save the milestone
     and the new element's name closes.**~~ v4, Processes, + Process,
     "Continue editing": no name field; typing is lost and Enter adds a
     second "New process". The prompt blurs the name input, which commits
     and closes on blur.
     Fixed 2026-10-20: In a milestone, the name of a newly added Warnier
     element stays open and focused after the save question is answered, so
     typing and Enter name it.
105. ~~**Hide from current view freezes a view that lists nothing.**~~ Hiding
     Validate in Processes writes the other 75 elements (65 neither process
     nor step) into the view's list; a step added on Payment Process later
     no longer shows in Processes. `removeNodeFromView` on a view whose
     filter is a chain.
     Fixed 2026-10-20: A view that lists nothing and shows what its filter
     gives offers no Hide from view (as a view per element); elements are
     left out through its filter, so what is added later still shows there.

*Run 28.* Covered: Smart Layout run, rerun and reload on the bookstore,
six sample views, the seven structure views of the user's injury model
and generated models of 1 to 584 elements, with curved and orthogonal
lines; the same file in two fresh pages; Studio against MCP `smart_layout`
on the same folder (same winner, same positions); line style per view
through reload, Smart Layout, undo, SVG export and MCP `edgeStyle`; Smart
Layout in milestones with Propagate, Discard and Save as new; zoomed-out
blocks; a collapse during a 10 s Smart Layout. Not covered: compact
relation labels, a view switch during Smart Layout on a large model,
alignments and pins with orthogonal lines, Tree Layout views. Its first
finding is item 118.

106. ~~**MCP `smart_layout` on a flow view reports a better layout, writes
     nothing, and reports it again on every call.**~~ Bookstore, Place Order
     Flow: "Force-directed (Eades); crossings 0 -> 0, overdraws 1 -> 0. No
     files changed." each time. Since #189 a flow view keeps no positions
     (`viewCanvasPositions` returns `{}`), but `FolderModel.smartLayout`
     still accepts dynamic views, and the tool's description says it
     arranges them. Run 34 saw `align_nodes` and `grid_nodes` write
     positions and alignments into a flow view that Studio never draws.
     Fixed 2026-10-20: `smart_layout`, `align_nodes` and `grid_nodes` refuse
     a dynamic view, as they refuse a table or a wiki, and their
     descriptions say static views only; `remove_alignment` still takes any
     view.
107. ~~**Expanding a container among many root elements leaves elements on
     top of each other.**~~ A tidy grid of 48 root systems with a collapsed
     system of 20 containers in the middle: Expand moves 22 elements and
     leaves 2 pairs overlapping (100 roots: 8 pairs). On the injury model,
     View 7, expanding Pain Assessment App moves 39 of 76 root elements and
     leaves 20 pairs overlapping, up to 220×101 px; it is saved so.
     `separateSiblings` (20 passes of pairwise pushes) in `toggleCollapse`
     is the likely cause (a guess).
     Fixed 2026-10-20: An expand pushes only the siblings it lies on, and
     what they would then lie on, outward from it, and sets apart children
     saved on top of each other: on 35 expands of generated grids and the
     injury model, 202 overlapping pairs before, 0 after, and the mean move
     of a moved element 357 → 238 px. On injury's View 7, Pain Assessment
     App now moves 49 of 76 root elements (39 before, leaving 20 pairs on
     each other).

*Run 29.* Covered: Studio and an MCP server writing one folder (#222):
edits on different and on the same element, typing while an agent write
arrives, a delete against an edit, a drag against `grid_nodes` and
`smart_layout`, milestones on both sides, hand edits just before Studio's
save, the server's merge during a 2 s `smart_layout` on `architecture/`,
and which files a merged save writes (only the changed ones, also on the
1148-element `architecture/`). Not covered: the desktop watcher, two
servers on one folder, milestones shown in Studio while the agent writes,
sequences and presentations on both sides.

108. ~~**An edit made while an agent writes the folder is lost by a page
     reload.**~~ Studio holds its saves while `.radical/agent-activity.json`
     is fresh ("Studio saves your changes when it pauses"); a reload in
     those 15 s drops a rename or a drag without a word, and the folder
     never gets it (also run 30). `flushSync` on pagehide calls
     `flushPersist`, which holds for the agent again; there is no
     beforeunload warning.
     Fixed 2026-10-20: A reload or a closed tab while Studio holds its saves
     for an agent no longer loses the edits: Studio writes them at once,
     merged with the agent's, and keeps them in the browser until a save
     lands, merging them into the folder's model when it is opened next.
109. ~~**After an outside change arrives, Undo cannot take back the user's
     own edits.**~~ Any reload of an outside edit (an agent's write, an
     editor) disables Undo: `loadDiagram` forgets the history on the
     keepUi reload. It always did (item 36), but since #222 every agent
     write reloads Studio, so Undo stays grey for an agent's whole run,
     also for the user's edits merged into it.
     Fixed 2026-10-20: Undo and Redo keep working while an agent writes the
     folder: they take back and give back the user's own steps on the model
     with the agent's changes in it, never take an outside change back, and
     name any value where the agent's change was kept. In Viewer, Presenter
     or a milestone an outside change still clears the history.
110. ~~**An element dropped on a view leaves it when the agent adds another
     element to that view.**~~ `merge3` treats a view's `nodeIds` (and
     `hiddenRelationIds`) as one value, so two additions conflict and the
     folder's list wins; the user's element stays in the model but on no
     view, and the notice says "Containers: nodeIds". The manual says a
     new element on each side stays.
     Fixed 2026-10-20: A view's element and hidden-relation lists merge as
     sets, so an element each side put on the same view stays on it, with no
     conflict notice.

*Run 30.* Covered: an agent's Forge run over MCP on a folder open in
Studio, all nine stages, with Radical views and with layer canvases:
languages and view structure, stage views before their elements,
refinement proposals (guard, accept, decline, reply, regenerate), the
Review stage, the Specification in Multi page, the Forge button and the
read-only run view, Follow on the canvas; the user acting during the run;
a client closed halfway and a second run; Studio's own Forge with AI
disabled. Not covered: the desktop build, `forge_wireframe` and
`forge_import_hub_concept` in Studio, Studio's own Forge with a key.

111. ~~**Completing a Forge stage throws away the layout its views got while
     it ran.**~~ The C4 stage's elements show in System context as the agent
     adds them (#225); Smart Layout there, saved, then
     `forge_complete_stage`: all four roots go to a 2×2 grid at x 0/360,
     y 0/280 (Library System 518,−8 → 0,280), and the view is "not laid
     out yet" again. `Forge.complete` in `apps/mcp/src/forge.ts` hands
     every filed node to `placeInViews`, which places the outermost again
     even where the view has a position for it.
     Fixed 2026-10-20: `forge_complete_stage` places only the stage's
     elements its views have no place for yet; what was laid out while the
     stage ran stays where it is.
112. ~~**An edit the user makes in Studio while a Forge stage is open counts
     as the stage's refinement, and Regenerate takes it back.**~~ A
     requirement renamed in Studio during Scenarios:
     `forge_complete_stage` reports it as refined "as the user accepted",
     Studio marks the stage ✎1, and Regenerate renames it back.
     `stageRefinements` diffs the whole model across the stage; only what
     `forge_answer_refinement` applied should count.
     Fixed 2026-10-20: Only what the user accepted of a stage's proposals
     counts as its refinement, in MCP and in Studio's Forge; an edit made
     meanwhile in Studio or another program is neither reported nor taken
     back by Regenerate.

*Run 31.* Covered: `radical check` against the Inspector's counts, also
with broken references written by hand; Inspector Settings (a goal
lowered, a baseline raised, a severity lowered); `radical diff` against
`get_changes` after MCP edits and a hand edit (identical text); Changes on
branch and Inspector › Changes against both; the git hooks across
checkout, a new branch and a commit; a base saved `--since HEAD`; ghosts
of removed elements; Back and Forward through Inspector › Changes. Not
covered: `--ratchet` against Studio's Ratchet, hooks with `core.hooksPath`
or worktrees, milestones next to Changes on branch.

113. ~~**A change undone by hand still counts as a change, and Studio and the
     CLI disagree on it.**~~ External ticked and unticked leaves `external:
     false` in the file, and Studio, `radical diff` and `get_changes` list
     `external: (none) → false`. A letter typed into an empty description
     and deleted counts as a changed element in Studio, while `radical
     diff` says "No model changes" and a reload says 0. `sameValue` in
     `model.ts` and `modelFieldChanges` in `modelChanges.ts` treat `""` and
     `false` unlike an absent field.
     Fixed 2026-10-20: A box ticked and unticked, or a text typed and
     deleted, is no change in Studio, `radical diff`, `get_changes` or
     `compare_milestones`, and the folder no longer writes `external: false`
     or other empty values (unless the property's default would show
     instead).
114. ~~**An element removed on the branch is drawn outside its container and
     over another element, and the view does not count it.**~~ Hooks command
     deleted from CLI: on Components its ghost lies 29 px right of the CLI
     frame and covers Diff command; the Components card counts nothing.
     The ghost takes All elements' position from `base.json` on every view
     (`showOverlay`), and `viewChangeCounts` counts a removal only in views
     whose `nodeIds` list it, so a view with a filter chain never does.
     Fixed 2026-10-20: On Changes on branch a removed element's ghost is
     drawn inside its container on every view, clear of what the container
     holds (placeGhosts), and every view that draws it counts it, views with
     a filter chain included.
115. ~~**Studio says "since main" for a base saved `--since HEAD`.**~~ The CLI
     says "since HEAD (473d593)"; the tooltip says "since main 473d593"
     with main elsewhere. `baseSince` in `modelBase.ts` and `ChangesTab.tsx`
     always write "main".
     Fixed 2026-10-20: The Changes on branch tooltip and the Inspector say
     what the base was saved since, as the CLI does; "main" only for the
     merge base with main.

*Run 32.* Covered: groups of views per element (#220) with undo, redo,
reload, milestones, the wiki and the MCP server; writing, renaming and
deleting in the wiki while a group exists; Multi page five levels deep
(#223) with writing in the deepest chapters; Depth in view properties; the
CLI's Confluence export offline. Not covered: Presenter slides of a
group's views, a wiki viewpoint marked View per element, Multi page speed
on a large model.

116. ~~**A rename or delete in a milestone changes the live view of that
     element, and Discard keeps it.**~~ Sample, group Components of a
     container; in v4 Payments Service renamed to "Payments Service v4",
     Discard: the element is "Payments Service" again, its view "Payments
     Service v4", and a later rename on live no longer reaches it. Deleted
     in v4 and discarded: the view comes back as a new view with 0 of its
     12 positions. `patchNode` and the delete path change the views live
     and milestones share; `liveBackup` holds no views.
     Fixed 2026-10-20: A rename or delete made in a milestone leaves the
     views as they are; Discard finds them unchanged, and Propagate renames
     or removes them on the live model along with the edit. A group's view
     is now always named after its element, also when the name was emptied
     on the way.
117. ~~**MCP `set_view_nodes` picks the elements of a view per element, and
     nothing in Studio brings them back.**~~ Accepted on a group's view
     (also run 34): the API view draws 1 of its 4 elements and not a
     component added to API later, the Shop view 0 of 6. Studio hides
     nothing from such a view by hand, its filter is read-only with no
     Show every element and no Detach; only deleting the group repairs it.
     `update_view` and `delete_view` refuse a group's views;
     `set_view_nodes` and the store's `setViewNodes` / `addNodeToView` do
     not.
     Fixed 2026-10-20: `set_view_nodes`, `create_view` with `nodeIds` and
     Studio's store refuse to list elements in a group of views per element
     or one of its views, as `update_view` does, and a list written there
     before is cleared when the groups are brought in step.
118. ~~**Opening a view per element in a milestone counts as a milestone
     edit, and back on live that view is never laid out.**~~ v1 shown, the
     never-opened Web Banking opened: Smart Layout runs, the "Editing
     milestone" prompt opens and the chip says unsaved (also run 28, where
     the layout is not kept and runs again on every opening). Back on
     live, API Gateway is 927 px from the rest (368 px when first opened
     on live). `arrangeOnFirstOpen` does not check `activeSnapshotId`.
     Fixed 2026-10-20: Opening a never-opened view per element in a
     milestone no longer runs Smart Layout or asks how to save the
     milestone; the view is laid out on the live model as soon as the
     milestone is left with it on screen.
119. ~~**Undo of an element written in the wiki also undoes Multi page and
     Depth.**~~ Write a container, switch to Multi page and Depth 3, Undo:
     the container goes and the wiki is back in Single page at Depth 1,
     saved. `_restoreHistoryEntry` keeps the wiki's page but not
     `wikiPageMode` and `wikiDepth`, and neither switch is an undo step.
     Fixed 2026-10-20: Multi page and Depth are undo steps of their own;
     undoing an element written in the wiki leaves the wiki's page mode and
     depth as they are.

*Run 33.* Covered: About Radical Studio in each perspective (the version
matches `radical --version` and `radical-mcp --version`); the welcome
screen and `?hub=` links; the Models dialog from Viewer; Back and Forward
through perspectives, a Viewer drag, two models and milestones; slides
with `focus`; the selection camera with a reload; eleven odd deep links;
the Radical menu at 600 to 720 px. Not covered: toolbar menus over the
card and the Forge panel, desktop and VS Code hosts, Quick Search in
Viewer, folder models.

120. ~~**Import from Hub in Viewer says "imported", then the concept is
     gone.**~~ Since #216 the Hub's Open in Studio link (`?hub=req-mfa`)
     lands in Viewer; Add to Model says "All 1 concept imported!" and draws
     the requirement, but the saved bookstore keeps 6 elements, and the
     switch to Designer drops it with no notice. The Radical menu's Import
     from Hub… in Viewer does the same. `handleImport` in
     `HubImportModal.tsx` writes into Viewer's sandbox; a Forge run
     switches to Designer first, the import does not.
     Fixed 2026-10-20: Add to Model in Viewer, from a Hub link or the
     Radical menu, switches to Designer, and the concept is saved with the
     model.
121. ~~**The Radical menu runs off a window lower than 732 px.**~~ It is 685 px
     tall from y 47, with no maximum height or scroll: at 1280×690 About
     Radical Studio is below the window, at 1280×650 Copy to clipboard too;
     only Tab reaches them. At 1280×720 the last 12 px are cut.
     `.app-menu-popover` in `studio.css`.
     Fixed 2026-10-20: The Radical menu stops above the window's bottom edge
     and scrolls, so every item is reached by mouse in a low window.
122. ~~**A drag made in Viewer or Presenter is saved by a metamodel edit made
     from there.**~~ Bookstore, Containers: in Viewer Payment Provider
     dragged 250 px down, then Metamodel editor… and a rename: the save
     writes the drag too (y 355 → 741.55; from Presenter 752.68), and a
     reload shows it in Designer. `setAppMode` parks and restores Designer
     only on the way out of and into Designer; autosave saves in metamodel
     mode, and `buildPersistData` writes the parked model only while
     exploring.
     Fixed 2026-10-20: Opening the metamodel editor from Viewer or Presenter
     goes back to Designer's model first, so a metamodel edit saves nothing
     dragged or explored there, and what it changes in the views stays on
     the way back to Designer.

*Run 34.* Covered: `get_issues` against Studio's Validation on the
bookstore, order-machine, the 7 Hub blueprints and the sample (identical);
`smart_layout` against Studio's on 8 views (see item 4); the view tools
(`create_view` from viewpoints, `update_view` on groups, `order_views`,
`upsert_viewpoint` and `delete_viewpoint`, also live in an open Studio);
milestones with a group; the metamodel tools on types in use. Not covered:
the Hub app itself, `remove_alignment` against Studio's pins,
`compare_milestones`, presentations, sequences, relation types against
viewpoint chains (read in the code only). Its first finding is item 117.

123. ~~**A deleted element type stays in the viewpoints that name it.**~~ A
     custom type Service and a viewpoint "Service map" (a view per
     Service): Delete type is accepted, in Studio and over MCP. The
     viewpoint keeps `subject: service` and a chain of `service`; its card
     still says View per element while no type chip is on, nothing in the
     editor clears it, and a new view of it is an empty group, yet
     `upsert_viewpoint` refuses that subject as an unknown type. Validation
     and `get_issues` say nothing. `metamodelWithoutNodeType` cleans
     parents and pairs (item 92), not viewpoints or view chains.
     Fixed 2026-10-20: A node or relation type cannot be deleted, in Studio
     or over MCP, while a viewpoint makes a view per element of it or names
     it in its filter, or a view's filter names it; the refusal names the
     viewpoint or view, and Validation lists a viewpoint that names a type
     the metamodel lacks.
124. ~~**A type that only a milestone still uses can be deleted, and Restore
     to live brings back an element of an unknown type.**~~ A Service saved
     in milestone As-is and deleted from the live model: Delete type is
     accepted (`delete_node_type` too); Restore to live puts the element
     back, and Validation and `get_issues` report "Node "Legacy Billing
     Service" has unknown type "service"". `checkRemoveNodeType` counts
     live elements only; item 31 dropped undo steps that hold a lost type,
     but not milestones.
     Fixed 2026-10-20: A node or relation type cannot be deleted while a
     milestone holds an element or relation of it ("the milestone "As-is"
     holds 1 element of type Service: delete the milestone first."), and
     while a milestone is open Studio counts the live model too.

To decide (runs 25 to 34): a view card of a view that shows every element
says "All nodes", not a count; a blank view is named "View N+1" (the
manual says View 1, View 2…); a filter edited while a milestone is shown
goes into the live document with no Editing milestone prompt; Fit All
leaves out the properties card; an image in a Markdown field
(`![x](http://…)`) is fetched, a request that leaves localhost; the card's
Parent field lists parents it then refuses; a Pseudostate added by a +
row under a machine with an initial one is initial too; the automatic
first-open layout of a view per element is an undo step of its own (three
Ctrl+Z to remove a group after opening two of its views); a delete in
Studio against the agent's edit of the same element brings the element
back without its relations and off every view; a component added into a
container the agent deletes meanwhile becomes a root on no view, without a
word; milestones made on both sides renumber the user's; a merged reload
writes the view's camera into `_layout.json` as `defaultViewport`; opening
a view on a folder rewrites `radical.md`'s name and the `_layout.json`
mirror; Follow on the canvas keeps the far end of a relation the view does
not show and, at a stage's end, jumps to a table where nothing of the
stage is framed; after an agent's run the Forge button opens only that run
for 30 minutes; with AI disabled Studio's Forge still saves the need and
makes its views, and opening it fetches `hub.radical.tools/hub/index.json`;
`forge_finish` counts an accepted proposal's elements as added and as
refined; Inspector Settings edits are a draft lost without a word on
another tab or Back; Show on canvas from an Inspector card makes two
history steps; "1 elements changed"; the toolbar counts elements only, so
a branch that only adds relations shows 0; Back from a milestone keeps it
and rewrites the history entries to open it; the Models dialog stays open
after a model is picked in its list; a `within` filter keeps a deleted
element (the view then shows 0) and `upsert_viewpoint fromViewId` copies
that chain, which `create_view` refuses; `upsert_viewpoint`'s description
names a `create_view` `subject` parameter that does not exist; Export as
PNG or SVG on a Warnier view says "There is nothing on screen to export";
the manual says Quick Search is on every view (line 170) and only on
canvases (line 590), and names a `radical check` rule "a step nobody
performs" that exists only in Forge; Redo after an undo made from another
view shows the view where Undo was pressed; a hierarchy view's Size by and
Max depth are saved with the view but are no undo step (as Multi page and
Depth were, item 119).

**Runs 35 to 44, 2026-10-21, commit 5015056** (main with the fixes of runs
25 to 34, PR #227), ten at the same time. 37 findings, each reproduced
again by hand; item 158 is a question of run 43 the maintainer answered
(typing a name is one step).
All 38 were fixed on 2026-10-21, each with a test that fails without the
fix; the "To decide" list is still open.

*Run 35.* Covered: Undo after an agent's write (item 109) across drags on
two views, New view, view type, Viewer, a second write and Redo;
milestones with a rebased history; Multi page and Depth after an outside
change; Undo of a drag on an element the agent deleted; Undo then a reload
while saves are held. Not covered: Presenter and the Inspector with a
rebased history, sequences, Save as viewpoint next to an outside change.

125. ~~**After an agent's write, Undo of an add leaves the element in the
     model, on no view, and blames the agent.**~~ Bookstore folder: drop a
     Software System, the agent edits Customer, Ctrl+Z: 7 nodes,
     `nodes/system` stays, and "Undo kept what was changed outside Studio
     since that step: System". A New view stays the same way. A guess: the
     folder writes no empty value (item 113), so the element read back has
     no `description: ''`, and the merge takes that for an outside change.
     Fixed 2026-10-21: Undo of an add or a New view after an agent's write
     takes it back, and no notice blames the agent; the merge treats an
     empty value as no value and lets a removal win over a change that is
     only layout.
126. ~~**An agent's write closes the milestone shown and loses its edits.**~~
     Open a milestone, rename an element, "Continue editing"; any agent
     write brings Studio back to Current (live) and the rename is gone, with
     no question; the live element gets the agent's highlight. `loadDiagram`
     resets `activeSnapshotId`, `liveBackup` and `milestoneDirty`.
     Fixed 2026-10-21: An agent's write leaves the milestone shown open with
     its unsaved edits; the change goes to the live model, a change to that
     milestone is merged in, and if it was deleted a notice says its edits
     are gone.
127. ~~**Undo after an agent's delete brings back a relation to the deleted
     element, or a child outside its deleted container.**~~ Delete Payment
     Provider, the agent deletes API, Ctrl+Z: "charges card" comes back from
     the missing API (`get_issues`: points at "api", which is no element);
     Orders DB comes back at the top level when the agent deleted Bookstore.
     No notice. `_rebasedEntry` merges by id and checks nothing.
     Fixed 2026-10-21: Undo or Redo after an agent's delete brings back no
     relation to the deleted element and no element inside a deleted
     container; a notice names what it left out.

*Run 36.* Covered: the expand of item 107 next to grids, rows, columns and
pinned elements, filter-chain views, Viewer and the injury model; moves
(item 102) through Move to…, the Parent field, Warnier, the wiki and MCP
`move_node`, on every canvas, with undo, redo and reload. Not covered:
expand or move in a milestone, several hundred elements, folder models.

128. ~~**A container collapsed and expanded again in a view hangs out of its
     parent.**~~ Sample, Core Banking, Banking Services collapsed and expanded:
     Core Banking Platform keeps its collapsed-time size (855 px high) and
     Banking Services ends 530 px below it; saved. `toggleCollapse` refits
     the parents with `loopVcs`, which still holds the container.
     Fixed 2026-10-21: A container collapsed and expanded again in a view
     lies inside its parent, which grows to hold it at its full size.
129. ~~**An element moved out of its container is still drawn on it.**~~ Move
     to… the parent's parent or the root, the Parent field, the wiki,
     Shift+Tab in Warnier and `move_node` keep its place, inside the old
     container's frame (Check the balance on Validate), on every canvas.
     Fixed 2026-10-21: An element moved out of its container (Move to…, the
     Parent field, the wiki, Warnier Shift+Tab, MCP move_node) is placed
     beside its new siblings, clear of its old container, on every canvas
     that draws it.
130. ~~**Move to… a container lays it out wrongly.**~~ Quote FX → Approve: drawn
     left of Approve, outside it; an element right of or below the target
     stretches the target over everything between them; on other views the
     container widens over a neighbour. The refit grows only right and down
     and makes no room.
     Fixed 2026-10-21: An element moved into a container keeps its place
     only where that lies inside it and clear of what it holds; otherwise it
     goes inside, beside them, the container grows, and what lies round the
     container moves out of its way, on every canvas (300 random moves: 681
     → 0 overlaps on the canvas shown, 59 → 0 on others; ~1.8 other elements
     moved per move, mean 77 px).

*Run 37.* Covered: the first opening of views (items 97, 118) in Designer,
Viewer, Presenter, milestones, deep links, Tree Layout, Undo of the first
layout, and MCP `create_view` against Studio. Not covered: a view switch
during a long first layout, matrix, hierarchy and wiki viewpoints in
milestones.

131. ~~**A slide of a view never laid out is drawn over itself.**~~ A view of
     six elements with no positions (as `create_view` makes it) on a slide:
     in Presenter API and Orders DB lie outside Bookstore and over Payment
     Provider; Viewer opens it at All elements' places. The slide code uses
     the view's positions only when it has some.
     Fixed 2026-10-21: A slide of a view never laid out opens on All
     elements' places, as the view does in Viewer, with its elements inside
     their containers.
132. ~~**A view's layout is lost when its type goes to Table and back with a
     reload or a view switch in between.**~~ System Context → Table → reload
     → Structure: All elements' places, saved. `viewCanvasPositions` keeps
     no positions for a view that is not a structure view.
     Fixed 2026-10-21: A view given another type keeps its layout through a
     reload or a view switch; turned back into Structure, it is drawn as it
     was.
133. ~~**A view whose filter leaves out a folded system draws nothing.**~~
     Bookstore folded on the model, + New view → Components: the card says 3
     nodes, the canvas is empty, Smart Layout says it already scores best
     (injury: 11 nodes, none drawn). `isNodeHidden` hides an element under
     any folded ancestor, also one the view does not draw.
     Fixed 2026-10-21: A view whose filter leaves out a folded container
     draws what the filter gives inside it, and Smart Layout arranges it; a
     view that shows the folded container keeps it folded.

*Run 38.* Covered: the slide dock, F5, ← →, Esc, the sample's slides,
rule 7 in Presenter, Back and Forward while playing, deep links and
reloads, MCP `create_presentation` with `focus`, agent writes during play.
Not covered: `update_presentation` while a slide shows, Flow and Hierarchy
slides stepping, several tabs.

134. ~~**A slide made with `focus` shows its whole view after a table slide,
     from a deep link or after a reload.**~~ Zoom 0.68 instead of 1.5;
     canvas to canvas it works. `goToSlide` / `previewSlide` call
     `__rfFocusNodes` before the canvas has mounted (item 41 fixed only the
     captured camera).
     Fixed 2026-10-21: A slide made with focus zooms onto its elements also
     after a table slide, from a deep link and after a reload; the focus
     waits for the canvas, and a canvas gone before its first camera takes
     nothing.
135. ~~**A view per element opened first in Viewer or Presenter is never laid
     out.**~~ Back in Designer it shows All elements' places (API Gateway far
     below the rest), the next switch saves them. `setAppMode` opens the
     view before `appMode` is Designer, so `arrangeOnFirstOpen` skips it.
     Fixed 2026-10-21: A view per element or of a viewpoint opened first in
     Viewer or Presenter gets its Smart Layout when Designer shows it.
136. ~~**An agent's write ends the presentation playing in Studio.**~~ Slide 3
     of "Agent deck" plays; any agent write: no HUD, Presenter on the first
     presentation; after F5 from Designer, Esc no longer returns to the
     view. `loadDiagram` resets the presentation state.
     Fixed 2026-10-21: An agent's write leaves the presentation playing, and
     Studio reads the change once it stops; Presenter keeps the presentation
     picked and its slide.
137. ~~**Link view and Link milestone on a slide card cannot be used.**~~ The
     picker is clipped by the dock: only the nearest item shows, a click on
     the others reaches the canvas. `.pres-dock` / `.pres-dock-track`
     overflow.
     Fixed 2026-10-21: The Link view and Link milestone pickers of a slide
     card open above the dock with all their items, and scroll when long.

*Run 39.* Covered: the filter editors in place (+ Filter, + or, Sort,
ways, a filter off) with six undos and redos and a reload; the same chain
as table, matrix, wiki, Warnier and hierarchy; views turned into
Structure; Save as viewpoint from a matrix; a `.radical` round trip. Not
covered: milestones next to filter edits, Presenter slides of these views,
folder models.

138. ~~**In a matrix whose filter is a chain, a click on an empty cell adds a
     relation the matrix does not draw, and each click adds another.**~~
     Requirements Register as a Matrix, one cell clicked three times:
     "Added relation" each time, three `derives` between the same pair, the
     cell stays empty. `MatrixView` sees only the chain's relations.
     Fixed 2026-10-21: With a chain, a click on an empty matrix cell adds a
     relation of a type the chain follows, so the cell shows it, or adds
     none and says why; it never adds a second relation where one is already
     there.
139. ~~**In a Warnier or wiki view whose filter leaves the new element out, an
     add is lost from sight without a word.**~~ Processes with the text filter
     "Payment": + Step adds "New step", no name field opens and the typing
     is lost; a requirement written on a wiki page with an "event-driven"
     filter is added and not shown. The table warns and fills the level's
     filters; Warnier and the wiki do neither.
     Fixed 2026-10-21: An element added in a Warnier or wiki view gets the
     values its filter asks for, as in a table; a Warnier name stays open
     while it is typed, and a message says when the view still does not show
     what was added.
140. ~~**A hierarchy drilled into an element its filter then leaves out shows
     the top level while the breadcrumb names the element; ↑ Up then shows a
     blank tile.**~~ `TreemapView` keeps a focus the model has but the view
     does not draw.
     Fixed 2026-10-21: A hierarchy drilled into an element its filter leaves
     out shows the top level with no breadcrumb or Up, and returns to the
     element when the filter shows it again.

*Run 40.* Covered: step notes, moves, removals and a repeated step with
undo; milestones holding sequences; Studio and an agent editing one
sequence; Viewer and Presenter; MCP `create_sequence`; the layout tools
refusing flow views; a deleted relation in `radical check`. Not covered:
linking a view to a sequence with undo, deleting an element whose
relations are steps, Presenter slides playing a flow.

141. ~~**Propagate after one note change makes every later milestone and the
     live model a copy of the milestone's sequence.**~~ One note changed in
     As-is, Propagate: the live Place Order goes from 5 steps to 2, Target
     loses a step. `commitMilestoneChanges` copies the whole sequence.
     Fixed 2026-10-21: Propagate carries forward only the steps and notes
     the milestone changed; later milestones and the live model keep the
     steps they added.
142. ~~**Studio and an agent editing one sequence: every note ends one step
     off.**~~ Studio removes step 1 while the agent changes note 3: the merged
     save pairs Studio's steps with the agent's notes. `merge3` merges
     `relationIds` and `stepDescriptions` apart.
     Fixed 2026-10-21: A sequence's steps and notes merge as one list of
     steps, so what each side added or removed stays and every note stays on
     its step; where both changed one note, the folder's is kept and named.
143. ~~**A step note field keeps a stale text, and leaving it writes it
     back.**~~ After Undo, and after switching to a milestone with the card
     open; a click in and out writes the old text again (in a milestone,
     with the prompt). The note is an uncontrolled input.
     Fixed 2026-10-21: A step note shows the note the model has now, also
     after Undo or a switch to a milestone, and leaving it writes only a
     changed text.
144. ~~**Clicking into a step note and out without typing is an undo step,**~~
     and in a milestone opens "Editing milestone". `updateStepDescription`
     does not check for a change.
     Fixed 2026-10-21: Clicking into a step note and out without typing
     changes nothing: no undo step, and no milestone prompt.
145. ~~**In Viewer and Presenter, picking a sequence turns on Editing, and a
     click on a relation adds a step.**~~ Not saved, and gone in Designer.
     `onEdgeClick` checks no perspective.
     Fixed 2026-10-21: In Viewer and Presenter a sequence picked is shown
     read-only, and a click on a relation selects it instead of adding a
     step.

*Run 41.* Covered: the Hub itself (catalogue, search, every category in
canvas, wiki and table, downloads, the basket and Open in Studio); imports
in a milestone with Propagate and Discard; imports in Viewer; blueprint
imports with undo, redo and reload; Studio's import against
`forge_import_hub_concept` on a folder (the same model). Not covered: Forge's
Hub cards, the desktop and VS Code hosts.

146. ~~**Apply in the Hub template section while a milestone is shown is lost
     without a question.**~~ p95 450, Apply: no prompt, no unsaved; Current
     (live) keeps 300 ms while `hubTemplates` says 450, so the live card
     shows 450 under Hub Template beside a sentence that says 300.
     `applyHubTemplate` does not mark a milestone edit.
     Fixed 2026-10-21: Apply in the Hub template section while a milestone
     is shown is an edit of the milestone; its values reach the live model
     only when it is propagated, and Discard puts them back (also: a
     discarded milestone import leaves no record).
147. ~~**A blueprint's Containers view, opened after a reload, draws elements
     on each other.**~~ Fintech imported on bookstore, its System context
     opened, reload, its Containers opened: the Ledger Platform frame covers
     root elements. The import gives its elements no All elements' places
     (1 of 39), and drops the views' own Hub positions.
     Fixed 2026-10-21: A blueprint's views open as the Hub drew them, also
     after a reload, and what an import brings onto a view has places on All
     elements too.
148. ~~**Import from Hub in Viewer with a container selected promises "↳
     Bookstore" and lands at the root.**~~ The switch to Designer (item 120)
     drops the selection before the import reads it.
     Fixed 2026-10-21: Import from Hub in Viewer with an element selected
     adds the concept inside it, as the card says.

*Run 42.* Covered: the wiki in Viewer, page-title renames with undo, the
element menu, EARS next to states, Multi page and Depth on the 1148-element
model (0.37 s at Depth 5), the wiki in a milestone, Presenter and deep
links, a folder model while an agent writes. Not covered: a wiki viewpoint
per element, wiki export.

149. ~~**The wiki search reads a requirement's sentence without its state.**~~
     With `precondition_state: confirmed` and the old text "the order is
     waiting", the page says "While the Order is Confirmed"; the search finds
     "waiting", not "Order is Confirmed". `searchableTexts` in
     `wikiSearch.ts`.
     Fixed 2026-10-21: The wiki search reads a requirement's sentence as its
     page writes it, with the state it points at.
150. ~~**On a requirement's wiki page the EARS sentence covers the facts box**~~
     (94 px on Strong customer authentication, at any width).
     `.ears-editable` is positioned and paints over the floated infobox.
     Fixed 2026-10-21: A requirement's sentence sits beside the facts box on
     its wiki page.
151. ~~**A slide added on a wiki page does not keep the page.**~~ Shown or
     played, it shows the page the view is on now (Overview after a reload).
     A slide keeps the hierarchy's level but nothing for a wiki.
     Fixed 2026-10-21: A slide added on a wiki page keeps the page and its
     Single or Multi page mode, and shows them on its card, when played and
     in the address, without changing the view's own page.
152. ~~**‹ Back from the first wiki page read does nothing.**~~ The tooltip
     names the wiki, the page and the address stay, and the Overview's
     history entry is overwritten. A route without `/f/` does not clear the
     wiki's page.
     Fixed 2026-10-21: Back from the first wiki page read goes to the
     Overview, and Forward returns to the page.

*Run 43.* Covered: `.radical` and folder round trips of the sample; Open →
File… of an old file; hand-edited folders; empty values (item 113); kept
edits (item 108); one folder in two tabs; PNG, SVG and clipboard exports
of the sample's 17 views; the Models dialog; the welcome screen; the
Structurizr DSL import. Not covered: the storage quota, the desktop app,
folders missing a file.

153. ~~**A `.radical` file that does not parse opens as an empty model and is
     overwritten with it.**~~ A trailing comma added by hand: after a reload or
     from Recent, 0 nodes, no message, and the file is rewritten empty, in
     Viewer with no edit. A file deleted outside Studio is recreated empty
     the same way. `loadDocument` returns null on a parse error.
     Fixed 2026-10-21: A .radical file that does not parse, or was moved or
     deleted outside Studio, opens with a message naming it and why, and
     nothing is saved to it (nor is it made again) until it reads again.
154. ~~**A Structurizr DSL import drops what follows an `enterprise` block or a
     relationship with a `{ … }` block, and turns `#` comments into
     elements.**~~ Big Bank plc: 18 elements and 0 relationships (26
     expected); "# the person who buys" adds a Person "person".
     Fixed 2026-10-21: The Structurizr DSL import reads an enterprise block
     as part of the model, skips a relationship's own block and deployment
     environments without losing what follows, and reads a # line as a
     comment (Big Bank plc: 18 elements, 26 relationships).
155. ~~**An edit undone while an agent writes the folder comes back after a
     reload.**~~ Drag, switch tabs and back, Undo, reload: the drag is back and
     saved. The tab switch kept it in `radical-unsaved-edits:<id>`, and
     `keepEdits` never clears an empty change.
     Fixed 2026-10-21: An edit undone after the tab was hidden stays undone
     after a reload; what was kept for the next visit goes once nothing
     differs.
156. ~~**A node file with a byte-order mark is missing for the MCP server and
     the CLI.**~~ Studio shows 6 elements, `get_model_summary` and `radical
     check` 5 with a dangling relation; the agent's next write drops its
     places. `parseMarkdown` does not skip U+FEFF.
     Fixed 2026-10-21: A node or JSON file saved with a byte-order mark
     reads the same for the MCP server, the CLI and Studio.
157. ~~**A node file moved by hand into another container is drawn far outside
     it.**~~ `orders-db.md` moved into `payment-provider/`: Orders DB at 1600,
     right of its parent (960–1260), also after a reload.
     Fixed 2026-10-21: An element whose file was moved by hand into another
     container is drawn inside it, beside what it holds, on every canvas and
     after a reload.
158. ~~**Each letter typed into the Name field is an undo step of its own.**~~
     "Card Gateway" typed, Undo: "Card Gatewa", "Card Gatew"… Typing a name
     is one step (the maintainer, 2026-10-21).
     Fixed 2026-10-21: What is typed into a field of the properties card (a
     name, a description, any text) is one undo step until the field is
     left.

*Run 44.* Covered: `radical hooks install` in a worktree and with
`core.hooksPath`; `radical diff` edge cases; `--ratchet` against Studio;
`remove_alignment`; `compare_milestones` (by code against Studio's diff);
presentations over MCP; two servers on one folder; tool descriptions. Not
covered: `remove_alignment` against real drags, Presenter playing MCP focus
slides in a browser, husky.

159. ~~**`radical hooks install` for a second model folder takes the first
     one's line out.**~~ The marker is shared, so the second install "updates"
     it, and the first folder's base is never saved again.
     Fixed 2026-10-21: Each model folder keeps its own line in the hooks;
     installing for a second folder adds a line.
160. ~~**`radical hooks install` appends a sh line to any hook.**~~ A Python hook
     then fails with a SyntaxError and stops running; after a hook ending in
     `exit` or `exec` the line never runs.
     Fixed 2026-10-21: The line goes right after the hook's #! line, where
     an exit or exec cannot skip it; a hook not written in sh is left alone,
     and the command exits 2 naming it and the command to call from it.
161. ~~**`--ratchet` without a test report lowers the test rules' baselines to
     0**~~ (CLI and Inspector › Settings): rules that did not run count 0 and
     show ✓, and the next run with reports fails.
     Fixed 2026-10-21: Without a test report the test rules do not run;
     --ratchet and the Inspector's Ratchet leave their baselines, and the
     output marks them "not run" instead of ✓ (also every model rule on a
     folder that is no model).
162. ~~**Two MCP servers on one folder lose one of two writes made within
     ~30 ms,**~~ while both report success: the check for outside edits and
     the write are not atomic (`MdFolderSession.write`).
     Fixed 2026-10-21: Two MCP servers, or a server and the desktop app,
     write one folder in turns (.radical/write.lock), so the second write
     merges with the first and neither is lost.

To decide (runs 35 to 44): an agent's write while the metamodel editor is
open clears Designer's undo history; an Undo conflict notice can name an id
(a pin left by a milestone drag); a New view of a viewpoint is two undo
steps (the view, its first layout); a reload within ~100 ms of New view
saves the view at All elements' places for good; after Undo of the first
layout the view is not laid out again; whether a move keeps the element's
place at all (decided 2026-10-21: only where it lies inside its new parent
and clear of its siblings, rule 4); a slide with no view shows the All
elements table, so its `focus` does nothing; a click in the middle of an
inactive slide card hits Capture, with no undo; Designer's camera moves
40 px coming back from Presenter; a hierarchy with a chain draws ancestors
the filter does not give; after an add in a table or wiki view the card
count and the save wait ~21 s (a hidden live layout keeps moving
`nodes[].x/y`); the wiki's Pages list stays A–Z under a descending sort; a
model opened from a downloaded file lands on All elements; an agent write
closes the sequence card; a flow view's zoom is lost on a reload; positions
can reach a dynamic view through `update_view` kind changes; a discarded
milestone import leaves its `hubTemplates` record (fixed with item 146); MCP and Studio fill a
template parameter differently (hint vs empty); a `?hub=` model lands on
All elements; after Undo of Add child or an agent's delete of the page's
element the wiki shows Overview while the address keeps `/f/<gone>`;
[rewrite] then Enter with no change overwrites a stale precondition text;
a sentence rewritten to the state phrase does not point at the state;
Multi page switched in a milestone stays live but its undo step goes with
the milestone; Edit facts offers external systems as a parent; Move to a
folder renames the model; a folder model's rename reaches `radical.md`
only at the next save; no way back from a file or folder to the browser;
the VS Code demo has a relation to a missing element; the DSL import drops
descriptions and technologies given inside a block and marks no external
system; `compare_milestones` ignores sequences; `radical diff | head` exits
with EPIPE; a renamed model folder makes `radical diff` report everything
added; a slide's focus keeps a deleted element; `create_presentation`
accepts focus on a table; `move_node` says it keeps the canvas position but
the element leaves `views.json`; hooks installed from a worktree fail
silently once it is gone.

**Runs 45 to 64, 2026-10-21, commit 3acb1c3** (main with the fixes of runs
25 to 44, PRs #227 and #228), twenty at the same time. 70 findings, 3 of
them duplicates, each reproduced again by hand; 67 items below (a duplicate
is listed once, naming the other run). All 67 were fixed on 2026-10-21, each
with a test that fails without the fix. About 40% of them are siblings or
regressions of earlier fixes, the same pattern left in another place: a
byte-order mark in `check.json` (177, after 156), the table's add in a
milestone (226, after Warnier's 104), stale wiki text written back (185,
after the step notes of 143), the Move to… menu (168, after the Radical menu
of 121).

*Run 45.* Covered: Undo and Redo after an agent's writes on a folder (item
109) for table cell renames, table rows, Move to folder against
`order_views`, step removals and notes against `update_sequence`, Save as
viewpoint against `delete_viewpoint` and `upsert_viewpoint`, wiki titles,
each with writes on other and on the same elements; several writes between
two steps; Viewer and Presenter with a rebased history. Not covered: the
metamodel editor open, Hub imports across a write, Undo on a flow view,
milestones, a drag against the agent's `add_node` on the same view.

163. ~~**Undo of an add takes away what the agent built on the element.**~~
     Bookstore folder: drop a Software System, the agent adds a container in
     it (with `set_view_nodes`) or a relation to it, Ctrl+Z: both go, with
     "Undo left out what needs an element removed outside Studio since that
     step: Agent Container"; Redo brings back only the system, and the
     folder loses the agent's container or relation. A guess:
     `_rebasedEntry` → `_withoutStrays` drops what the step's own reversal
     orphans, and the redo step never held it.
     Fixed 2026-10-21: Undo of a step whose element the agent has since
     built on (added a child into it or drew a relation to it) keeps that
     element with what the agent built, and a notice says so.
164. ~~**A name typed while an agent writes is two undo steps.**~~ Typing
     "Orders", an agent write, "API", Tab: the first Undo leaves
     "OrdersAPI", the second gives "API"; without the write one Undo takes
     back the name, and during a Forge run it is one step per agent write
     (item 158 undone). Cause (fairly sure): `_pushTextEdit` checks
     `_typing.step === top` by identity, and `_historyRebased` replaces the
     entries.
     Fixed 2026-10-21: what is typed into a field is one undo step even when
     an agent writes the folder meanwhile.
165. ~~**Undo of Keep in a row after the agent's `align_nodes` on the same
     view puts the row back only sideways.**~~ Customer ends at (355, 41)
     instead of (355, 0), Payment Provider at (960, 36) instead of (960,
     355); saved. A guess: the reload's constraint enforcement moves the
     row's y by 0.04 px, and `merge3`, which merges each coordinate apart,
     keeps y as an outside layout change.
     Fixed 2026-10-21: Undo of Keep in a row after an agent's alignment puts
     the row's elements back exactly where they stood.

*Run 46.* Covered: Move to… into ordered and unordered rows and grids; a
parent collapsed on the model or the view, with expand and reload; pinned
children with undo, redo and reload; views that do not draw the parent;
Discard and Save as new in a milestone; MCP `move_node` into a collapsed
parent and a grid member; 300 elements. Not covered: the wiki and the Parent
field in a milestone, Propagate, Studio and MCP live during a move.

166. ~~**An element moved into another member of its grid breaks the grid.**~~
     Grid S1 to S4 in 2 columns, S4 Move to… S2, reload: S1 and S3 overlap
     by 70 px, and saved places change (S3 318 → 188, S4 120 → 250, S2 −22 →
     −62). The grid still holds S4 inside S2, which Align refuses to make;
     MCP `move_node` does the same without a warning. A guess:
     `reparentNodes` leaves `layoutConstraints` and
     `defaultLayoutConstraints` as they are.
     Fixed 2026-10-21: a move takes the element out of the rows, columns and
     grids it would share with its new parent, on every canvas, in Studio
     and over move_node.
167. ~~**Move to… in a milestone, then Discard, moves the element on every
     live view.**~~ S1 (0, 75) → (1480, 0) on live, all four elements of Part
     move; saved, kept by a reload, and the same with Save as new. Run 64 on
     the sample: v3, Fraud Detection → Banking Services, Discard: live Core
     Banking Platform 1230 → 1570 px wide, Risk & Data 460×500 → 790×360,
     Fraud Detection drawn 440 px right; five other views and All elements
     lose its place, "not laid out yet" after a reload. Undo before the
     choice puts it right; a discarded drag does not leak. A guess:
     `reparentNodes` (`model.ts`) writes `views[].positions` and
     `defaultPositions` in a milestone, and Discard and Save as new restore
     only nodes, relations and sequences.
     Fixed 2026-10-21: Move to… in a milestone leaves the live views and All
     elements as they were after Discard or Save as new; Propagate carries
     the move into them.
168. ~~**The Move to… menu runs off the top of the window.**~~ Sample, Payment
     Process, Book the ledger at 1280×720: the first item at y −38; with 59
     parents 44 items are above the window, with no scroll. Wrap into… and
     Change source/destination… use the same popover. A guess:
     `.sel-bar-menu` in `studio.css` opens upward with no maximum height (as
     the Radical menu did, item 121).
     Fixed 2026-10-21: the selection bar's menus (Move to…, Wrap into…,
     Change source/destination…) stay inside the window and scroll, and
     answer ↑/↓.

*Run 47.* Covered: collapse and expand cycles on the sample, on generated
models of 30, 228 and 580 elements and on a filter-chain view; a nested
chain of six undo steps (exact); canvases kept apart; Viewer, Presenter and
a milestone in Viewer; Smart Layout around collapsed containers; rolled-up
relations; a folder with an agent. Not covered: the injury model, a
`.radical` round trip with collapsed views, collapse inside rows and grids,
Warnier and Screen Map groups, desktop.

169. ~~**A container collapsed and expanded again comes back about 40 px
     higher each time.**~~ Sample, Core Banking, Banking Services: y 770 → 725
     → 685 → 645 (x +5 each), saved; after six cycles it pushes Access &
     Security 135 px up and Core Banking Platform grows upward. On 580
     elements one cycle of System 2 moves System 0's 145 elements 25 px;
     after an agent folds Bookstore, Studio's expand moves it 290 px left
     and 130 px up. A guess: `toggleCollapse` shrinks toward the frame's
     centre, and the expand centres the children's bounds, lower by the
     header, on the box.
     Fixed 2026-10-21: a container collapsed and expanded again comes back
     where it was; the expand centres the frame its children open to on the
     folded box, the reverse of the collapse.
170. ~~**Collapse while a milestone is shown collapses the live view.**~~ v4:
     the view's `collapsedNodeIds` is saved at once, with no prompt, and
     live Undo is disabled; on live the box sits at the old frame's corner
     (50, 770) in a parent still 1440 px high, and the view is "not laid out
     yet", also after a reload. A guess: `toggleCollapse` writes the view
     milestones share and does not call `_markMilestoneEdit`.
     Fixed 2026-10-21: A collapse in a milestone asks how to keep it, is not
     saved into the live view, and Discard takes it back.
171. ~~**A slide does not keep the collapse state it was captured with.**~~ A
     slide captured with Banking Services open shows it folded after a
     collapse in Designer; one captured folded shows it open, at the folded
     box's place, 405 px outside Core Banking Platform. `captureCanvasState`
     keeps only the model's `collapsed`, not the view's (read in the code).
     Fixed 2026-10-21: a slide shows its view folded or open as it was
     captured, whatever the view does later.
172. ~~**An agent's `update_view` expanding a container folded in Studio draws
     it over its neighbours.**~~ Bookstore folder: Bookstore is drawn at the
     folded box's place at full size (290, 355, 860×350), over Payment
     Provider; saved. A guess: `model.setViewCollapsed` edits the lists only
     and places nothing.
     Fixed 2026-10-21: a container opened or folded on a view by the agent
     changes size round its middle as in Studio, with room made, instead of
     opening over its neighbours.

*Run 48.* Covered: a milestone shown while the agent creates, updates or
deletes milestones or edits the live model, Propagate; Designer → Viewer →
Designer; the agent deleting the view a milestone shows; a step note in a
milestone against live notes; presentations against `update_presentation`;
metamodel edits on both sides; relations deleted against updated; renames
against a rename, `move_node` and a sibling's rename; kept edits through a
reload while saves are held. Not covered: a view folder rename against
`update_view` folder, Save as viewpoint against `upsert_viewpoint` with the
same label, groups of views on both sides, the desktop watcher, two servers.

173. ~~**A viewpoint deleted in Studio comes back when the agent deletes
     another.**~~ C4 preset folder, saves held, each side deletes one:
     `metamodel.json` lists only `removedViewpoints: ["components"]`, 5
     viewpoints instead of 4 (also after a reload and in
     `get_model_summary`), and the notice says "folder's was kept:
     metamodel: removedViewpoints" where nothing conflicted. A guess:
     `removedViewpoints` is not in `ID_SET_KEYS` (`modelMerge.ts`), so it
     merges as one value; allowed parents and enum options likely the same
     (read in the code).
     Fixed 2026-10-21: viewpoints, allowed parents and enum options deleted
     on both sides stay deleted after a merge, and no conflict is reported
     where none happened.
174. ~~**A view emptied on both sides shows the whole model.**~~ View Duo of
     Customer and Payments: Studio hides Customer while the agent sets
     `set_view_nodes ["customer"]` (or deletes Payments): `nodeIds` becomes
     [] with no `empty`, all 6 elements are drawn, "All nodes", no notice,
     also after a reload. The other way, Studio adds an element while the
     agent sets [] (every element): Duo shows only the new element. A guess:
     `mergeIdSet` treats [] as an empty set, while a view reads [] as every
     element unless marked empty (item 60, through the merge).
     Fixed 2026-10-21: a view whose listed elements are taken out on both
     sides stays empty, and a view of every element stays one when the other
     side adds an element.

*Run 49.* Covered: stale and odd write locks (a dead pid, a live foreign
pid, garbage, a directory, a time in the future); SIGKILL during
`create_milestone` (8 times); two and three servers with `radical check` and
`radical diff` in loops (50 of 50 nodes); odd paths and Unicode labels;
`get_selection` with odd files; `update_relation` properties; hand edits.
Not covered: Studio next to the lock, the desktop watcher, network folders.

175. ~~**A read-only model folder cannot be checked, diffed or served.**~~ With
     `.radical/` in it, `radical check` and `radical diff` exit 2 with
     EACCES on `.radical/write.lock`, and the MCP server does not start. A
     guess: `MdFolderSession.readAll` takes the write lock, and
     `takeWriteTurn` (`diskFolderStorage.ts`) creates it with `wx` and
     handles only EEXIST.
     Fixed 2026-10-21: A folder the user may only read can be checked,
     diffed and served by the MCP server: a read takes no write turn there,
     it only waits while another program is writing.
176. ~~**An element whose label has a character outside the BMP at the 60th
     place is deleted by the next write.**~~ `slugify` cuts at 60 UTF-16 units
     and splits the surrogate pair, the file name gets U+FFFD, and the next
     write's pass over stale files deletes it: 1 of 2 nodes left and an
     empty directory. A guess: `.slice(0, 60)` in the folder format's paths
     (`mdFolderPersistence`).
     Fixed 2026-10-21: file names are cut at 60 characters, never in the
     middle of one, so the element's file survives the next write.
177. ~~**`radical check` refuses a `check.json` saved with a byte-order
     mark.**~~ It exits 2 with "not valid JSON". `apps/cli/src/check.ts` (line
     95) and `readCheckFiles` in node-files' `selectionFile.ts` do not strip
     the mark; item 156 covered node and model files only.
     Fixed 2026-10-21: radical check and the Inspector read a check.json
     saved with a byte-order mark.

*Run 50.* Covered: the Structurizr DSL parser on groups, enterprise,
deployment environments, styles, relationship blocks, comments, `this`, text
blocks, archetypes, `!include` and `extends`; the import's table, New view
of viewpoints, geometry and undo; round trips browser → file → folder; a Hub
import into an imported model; Hub Download → Open → File… for 4 concepts;
the CLI's Confluence export escaping. Not covered: PNG and SVG of imported
views, the Gherkin export, Confluence publish, desktop `--file`.

178. ~~**A Structurizr import with `!identifiers hierarchical` joins
     relationships to the wrong elements.**~~ Two systems, each with
     `api.controller` and `api.repository`: 5 of 6 relationships, 3 of them
     to the other system's elements ("Places orders using" Customer →
     Payment Controller), "Requests payment from" gone, no message; a root
     `email` next to `bank.api.email`: 0 of 1. A guess: `structurizrDsl.ts`
     registers keys only as `<ancestor>.<var>`, `resolveId` falls back to a
     suffix a later system overwrites, and a bare name in `varMap` is
     overwritten too.
     Fixed 2026-10-21: with `!identifiers hierarchical` each relationship
     joins the elements its full or relative path names; one that names no
     element, or a name two elements share, is left out and the import says
     so.
179. ~~**A Structurizr import brings in relations and parents the metamodel
     forbids.**~~ Big Bank plc imports with 7 validation issues (person →
     person, container → component), pairs that Studio and MCP
     `add_relation` refuse; a group inside a container imports ("Group
     cannot be inside Container"), and its Containers view drifts ~33 px per
     reload. A guess: `parseStructurizrDsl` and `handleDsl` (ModelSteps)
     never check the metamodel; the C4 preset lacks container and web app →
     component, and person → person.
     Fixed 2026-10-21: Big Bank plc imports with nothing Validation flags;
     C4 relates person → person and container or web app → component, as
     Structurizr does; a group inside a container is left out (its
     components go to the container), and the notice says so.
180. ~~**An imported model's new view is drawn elsewhere after the first
     reload.**~~ Big Bank plc with a group, New view → Containers, reload: all
     12 elements move (Customer (1172, −387) → (900, −132)) and the saved
     view is rewritten; the groups example moves on every reload. Seeded
     with real positions it holds. A guess: the saved view gives API
     Application its expanded size while its hidden components have no
     positions, and `placeUnplaced` on load and the physics move them.
     Fixed 2026-10-21: a view of an imported workspace is drawn the same
     after a reload; a container the view shows without its children is
     checked at its folded size.

*Run 51.* Covered: processes in a system, a group and a domain (Enter, Tab
refused, Alt+↑/↓, geometry); fast outline typing; undo keys while naming;
deleting a step that has `performed-by`, with undo and redo; trees of 100 to
300 steps; a folder with MCP `add_node` while a name is open; Propagate and
Discard; an F5 slide; a `within` filter against the table. Not covered:
export, chains of several levels, Forge's Processes stage, Save as new after
Warnier edits, table and wiki slides during F5.

181. ~~**Propagating a move made in an older milestone puts the step under a
     parent the later models lack.**~~ S1: Train, Tab into Extra (deleted in
     S2 and on live), Propagate: S2 and live get `Train.parentId = st-bx`,
     which does not exist; Warnier draws Train at the top level with Parent
     "—", though a step may not be at the root; also after a reload. A
     guess: `commitMilestoneChanges` → `applyDiff` copies `parentId`
     unchecked (item 73 handled deletes only).
     Fixed 2026-10-21: Propagating a move leaves the element where it is in
     a later model that lacks its new parent.
182. ~~**+ Process in a Warnier view filtered to "Inside Bank" adds the
     process at the top of the model.**~~ It is not shown, only a warning says
     so; a table with the same chain adds the process in Bank. A guess:
     `addProcess` in `WarnierView.tsx` uses only
     `newElementFilters().properties` and ignores `within` (next to item
     139).
     Fixed 2026-10-21: + Process in a Warnier view filtered to inside an
     element adds the process inside that element.
183. ~~**A Warnier slide played with F5 from Designer can be edited, and
     Ctrl+Z after Exit adds the edit to the model.**~~ 21 controls answer;
     Exit drops the edit, then Ctrl+Z adds "Mid" to the model (saved,
     Train's order 2 → 3), and a second Ctrl+Z leaves "New step". A guess:
     `readOnly = appMode !== 'designer'` ignores `presentationActive`, and
     `stopPresentation` keeps the slide's undo steps (a neighbour of item
     83; table and wiki slides maybe too).
     Fixed 2026-10-21: a slide played from Designer cannot be edited, so
     Undo after Exit has nothing of it to add.

*Run 52.* Covered: Markdown in descriptions (no script runs, no outside
request); search after writing and renames; the glossary after writing and
undo; Back and Forward over 8 pages; a wiki viewpoint per element; Multi
page with a chain; PNG and SVG export; the CLI's Markdown and HTML export; a
folder with the agent's rename. Not covered: the Hub's wiki viewer (probably
item 187 too), Presenter on a wiki per element, Confluence publish.

184. ~~**The wiki search reads descriptions as Markdown source, not as the
     page shows them.**~~ "and checkout UI" and "see the guide" find 0 pages;
     "docs.example", only in a link's URL, finds Web App with a raw snippet;
     on `architecture/`, "**Proposed approach:**" is searched as written. A
     guess: `searchableTexts` in `wikiSearch.ts` does not use
     `markdownToPlain`.
     Fixed 2026-10-21: the wiki search finds words as the page shows them,
     not a link's address or `**`.
185. ~~**Wiki text clicked into before an agent's edit writes the old text
     back when left.**~~ Title focused, MCP `update_node` renames Web App to
     Storefront, click out: "Web App" is back in the model and the folder,
     no notice; a description does the same. A guess: `InlineText` in
     `WikiView.tsx` keeps its draft while editing and commits the stale
     draft (the pattern of item 143).
     Fixed 2026-10-21: text opened before an agent's edit shows the edit,
     and leaving it writes nothing.
186. ~~**The wiki Overview counts the whole model's relations.**~~ Architecture
     Wiki "14 elements · 125 relations" while its glossary has 8; Product
     Wiki 125 against 50 (noted in the To decide of runs 13 to 24).
     `WikiView.tsx` (about line 692) takes
     `Object.keys(c4Relations).length`.
     Fixed 2026-10-21: the Overview counts the relations between the wiki's
     own pages.
187. ~~**One letter in Search pages crashes Studio on a wiki whose chain
     loops.**~~ Filter Container, Web App and Database, then any relation to
     the same level: "Maximum call stack size exceeded" and the error
     boundary; Multi page at Depth 5 writes API › Orders DB › API… A guess:
     `createWikiDocument`'s merged `chainChildren` index has cycles, and the
     navigation's `renderNode` and the chapters keep no ancestor guard.
     Fixed 2026-10-21: a wiki whose chain loops is searched without a crash,
     and its chapters do not repeat their ancestors.
188. ~~**`radical export confluence --format markdown` copies description
     Markdown raw.**~~ A "# Notes" heading outranks "## Bookstore" and the
     children fall under it; a raw `<img onerror>` and `[x](javascript:)` go
     out as they are; the html and storage formats shift, escape or drop the
     same text. `fieldValue` in `apps/cli/src/wikiExport.ts` returns
     `field.text` for Markdown.
     Fixed 2026-10-21: a field's headings come out below the element's
     heading and below its children's, in Markdown, HTML and storage alike;
     raw HTML and javascript: or relative links go out as text.

*Run 53.* Covered: every card control on every Radical type and 7 relation
types with undo and redo (120 edits, exact); a relation label typed in a
milestone; Studio and an agent on one relation; Hide relation with undo and
reload; the read-only card in Viewer. Not covered: a relation's type changed
in a milestone, the Change source/destination menus, properties left after a
type change, the EARS While in state select, the need, blueprint, system and
group cards. Its first finding is in item 221.

189. ~~**An agent's write closes the card of a selected relation while it is
     typed in.**~~ Bookstore folder, a relation's label being typed, any agent
     write (also `update_relation` on that relation): the focus goes and the
     next keys are lost (what was typed before stays); an element's card
     stays open. A guess: `showSelection` keeps an edge only if `rfEdges`
     has it, and the reload restores the selection before the edges are
     derived.
     Fixed 2026-10-21: an agent's write keeps the selected relation's card
     open, with its focus and what was typed.
190. ~~**In Viewer and Presenter a relation's ends can be dragged to another
     element.**~~ API → Web App rewired on the canvas and in the read-only
     card; not saved, back in Designer, no notice. A guess:
     `ReconnectHandle` in `RelationEdge.tsx` is drawn for `selected &&
     !isVirtual` in any perspective (like item 145).
     Fixed 2026-10-21: a relation's end handles appear in Designer only.

*Run 54.* Covered: a chain view live and in v4 and v1; Presenter slides of a
chain view (rule 7, identical bytes); a folder with agent adds in and out of
the chain and a reload; `within` filters with agent moves, deletes and undo;
a containment chain with collapse and Smart Layout; a chain both ways as
canvas, matrix, table and hierarchy; no filter editor in Viewer; MCP chains
against Studio's. Not covered: the wiki of a two-way chain, undo of filter
edits in a milestone, `upsert_viewpoint` with bad chains, concurrent chain
edits, the injury model.

191. ~~**On a canvas whose filter is a chain, Alt-drag and the palette add
     what the canvas does not draw.**~~ Trace chain (Need ← derives ←
     Requirement ← verifies ← Scenario): two Alt-drags add 2 identical
     `derives` relations (125 → 127) while 10 lines stay drawn; a
     Requirement dropped from the palette is added and not drawn; no notice.
     A guess: `Canvas.tsx` (about line 1027) calls `addRelation` without
     `chainRelationFor`, and `onDrop` uses no `newElementFilters` (the
     canvas sibling of items 138 and 139).
     Fixed 2026-10-21: on a canvas whose filter is a chain, a relation drawn
     is one the chain follows or is refused with the reason, and a dropped
     element the filter leaves out is announced.
192. ~~**MCP `update_view` and `create_view` accept filters they then read
     otherwise.**~~ A chain step with `via` and no direction is saved as a
     step taking nothing ("Updated"; the view shows 3 of 10, `via` dropped);
     a relation filter without direction is read as in; a property filter on
     an unknown key and an unknown op ("like" acts as is-not) are accepted.
     The schema's "A way with neither types nor via takes every element" is
     false on later levels. `readPipeline` (`viewPipeline.ts`) drops `via`,
     and `pipelineFor` (`viewTools.ts`) checks only types, relation types
     and `within`.
     Fixed 2026-10-21: create_view and update_view refuse a chain they would
     read otherwise than written, and say what is wrong.
193. ~~**MCP `smart_layout` called twice picks another winner the second
     time.**~~ 13 elements: call 1 Layered TB, call 2 Layered LR with
     crossings 0 → 0, and `views.json` changed; only call 3 says already
     best, where Studio says so after the first. A plain list view too.
     Cause not found; a guess: the server scores its saved winner
     differently (`FolderModel.smartLayout` → `runSmartLayoutCore`,
     `keptCurrent`).
     Fixed 2026-10-21: Smart Layout run again on the layout it just made
     keeps it; its winner is ranked among the new layouts alone, not against
     the layout it started from, and a layout several candidates came out
     as counts once.

*Run 55.* Covered: one concept imported twice with Apply on the first (exact
undo and reload); undo and redo of Apply; a folder with agent writes around
an import, Apply and undo; blueprint views in a folder across a reload;
Apply in a milestone with Save as new. Not covered: a custom metamodel
lacking the types, Forge's Hub cards, an import with a template in Viewer,
MCP `forge_import_hub_concept`'s record against Studio's.

194. ~~**Apply in the Hub template section leaves flow step notes at the old
     value.**~~ E-commerce blueprint, p95 800 → 500: the requirement and 2
     mockups say 500, Shopper journey's step 4 still 800 ms, also after a
     reload. A guess: `applyHubTemplate` (`diagramStore.ts`) rewrites only
     the record's `originalNodes`, and the record keeps no original
     relations or sequences (item 89 reached step notes on import only).
     Fixed 2026-10-21: Apply changes the value in the imported relations and
     in the flows' names and step notes too, as one undo step (imports made
     from now on; older records hold no original relations or flows).
195. ~~**A concept downloaded from the Hub keeps its `{{KEY}}` placeholders.**~~
     Download, then Open → File…: e-commerce has 13 texts with them (API
     Response Time "within {{P95_MS}} ms") and no `hubTemplates` record,
     where Add to Studio fills 300 and keeps a record. A guess: the Hub's
     `downloadConcept` (`HubApp.tsx`) hands out the catalogue file, and
     Studio's `loadDiagram` keeps its hub block as an unused `hubMeta`.
     Fixed 2026-10-21: a concept file from the Hub's Download opens with the
     template's defaults filled in and a record, so the Hub Template section
     can change them, as after Add to Studio.
196. ~~**Apply undoes a rename of an imported element.**~~ ADR "Primary Data
     Store" renamed "ADR-007 Orders on PostgreSQL", DATABASE → MySQL, Apply:
     the label is "ADR: MySQL as primary data store". Any edited field that
     holds a parameter is replaced. A guess: `applyHubTemplate` rewrites
     from the Hub's original every field whose original has a placeholder
     (item 90 covers only fields without one); maybe a question of design.
     Fixed 2026-10-21: Apply replaces the old value with the new one in the
     text as it is now ("ADR-007 Orders on PostgreSQL" -> "ADR-007 Orders on
     MySQL"); a text without the old value stays as it is.

*Run 56.* Covered: Capture again on hierarchy and canvas slides, with undo;
the Link view and Link milestone pickers; the diff toggle with cards and F5;
MCP reorders; all 13 sample slides; F5 from Designer; a slide's milestone
deleted or renamed; a slide of a deleted view; Designer undo and redo after
slide edits (exact); Presenter → Viewer. Not covered: two tabs, wiki slides
captured again, several presentations with MCP, the clipboard.

197. ~~**Capture again on a Hierarchy slide keeps the old drill level.**~~
     Sample, slide 13 added at Banking Services, drilled to Risk & Data,
     Capture again: the card and play show Banking Services
     (`treemapFocusId` dom-banking). A guess: `captureSlideViewport`
     (`diagramStore.ts`) does not take `treemapFocusId` (maybe not the wiki
     page either).
     Fixed 2026-10-21: Capture takes the hierarchy level or wiki page shown
     now.
198. ~~**Link view draws the linked view at the old view's places.**~~ A slide
     on System Context, Link view → Core Banking: Core Banking Platform
     150×97 with its 3 groups outside it. A guess: `linkViewToSlide` changes
     only `viewId` and keeps `canvasState` (MCP drops the framing).
     Fixed 2026-10-21: a slide linked to another view fits that view at its
     own places.
199. ~~**MCP `update_presentation` reordering slides by `{id, name}` drops
     every slide's view and framing.**~~ `viewId` null, zoom 0, no
     `canvasState`; the first card plays the All elements table.
     `parseSlides` (`presentationTools.ts`) reads a missing `viewId` as
     null, while a missing milestone or focus keeps the old.
     Fixed 2026-10-21: update_presentation keeps a slide's view and framing
     unless viewId is given.
200. ~~**After an agent reorders the slides, Presenter highlights another
     slide than the canvas shows.**~~ A guess: `setPresentations` keeps
     `presentationSlideIndex`, an index, not the slide's id.
     Fixed 2026-10-21: after the slides are reordered from outside, the
     slide shown stays the highlighted one.
201. ~~**Esc ending F5 on a drilled-in Hierarchy slide drills Designer's
     view.**~~ Designer's `treemapFocusId` is saved as sys-core (it was at the
     top); a double-click while playing is saved too; no undo step. A guess:
     `TreemapView`'s window keydown for Esc runs together with the HUD's,
     and `startPresentation` keeps only nodes, relations and the view.
     Fixed 2026-10-21: Esc ends a playing hierarchy slide; drilling while it
     plays changes nothing in Designer and leaves no element in the address.
202. ~~**F5 then Esc with the milestone diff on loses the diff.**~~ Diff tags 4
     → 0 while the button still says on, and off and on again does not bring
     them back (also Present from Presenter). A guess: `stopPresentation`
     calls `setDiffHighlight({})`.
     Fixed 2026-10-21: Ending a presentation gives the milestone's diff
     back.

*Run 57.* Covered: linking a flow view to a sequence with undo, redo and
reload; Create Flow view from a sequence; deleting an element whose
relations are steps, with undo; deleting a relation used twice; a Presenter
flow slide with F5; a folder round trip of sequences; MCP `update_sequence`
with a milestone shown; relation ends changed outside Studio. Not covered: a
`.radical` round trip, a relation's type changed, a Presenter slide with a
milestone on a flow, flow zoom.

203. ~~**The milestone diff on a flow view misses steps whose relation appears
     twice.**~~ As-is r1 r2 r3 r4 r2 → Target r1 r2 r3 r4: no ghost; a copy
     added: no NEW; a note changed on step 5 colours steps 2 and 5. A guess:
     `computeSeqDiff` (`diagramStore.ts`) compares sets of relation ids,
     `diffHighlight` is per relation, and `SequenceView` draws no ghost for
     an id the current set holds.
     Fixed 2026-10-21: A flow view's diff compares step by step: a relation
     used twice gets its own ghost, NEW and CHANGED.
204. ~~**A relation used by two adjacent steps loses a note in a merge.**~~
     Notes "validates" and "submits": Studio removes the step "validates"
     while the agent changes the note "submits"; the folder keeps "submits",
     and the agent's note is lost under "folder's was kept". Undo of the
     remove after the agent's change gives `submits (agent) | submits`, and
     "validates" is lost. Cause (checked): `alignSteps` in `modelMerge.ts`
     pairs steps by relation id greedily.
     Fixed 2026-10-21: steps of a relation used more than once are matched
     by their notes, so each side's note change stays on its step.

*Run 58.* Covered: the CLI's text, json and github output, exit codes,
malformed reports, rules not run, `--ratchet` on a folder that is no model,
`--evidence`; the CLI against the Inspector on `architecture/` with reports
(identical), the sample folder and the 7 Hub blueprints; Settings Save
writes only `check.json`, with undo; Changes on branch disabled in a
milestone; deep links, Back and Forward. Not covered: Peek's Show on canvas
in a milestone, JUnit entities, Playwright with several projects, an invalid
`readAt`, desktop.

205. ~~**The Inspector's Ratchet lowers a folder rule's baseline the CLI still
     counts.**~~ `folder-not-a-node` max 1 → 0 while the CLI still finds 1, so
     CI goes from 1 to 2 errors; with the rule at error the Inspector says
     "✓ No errors · 11 warnings" and the CLI "✖ 1 error", exit 1. A guess:
     `checkModel` skips folder rules, but the settings report them as run
     with 0, not as not run (as in item 161).
     Fixed 2026-10-21: Studio marks the rules about the folder's files as
     not run, so the Inspector's Ratchet leaves their baselines and Settings
     show — for them.
206. ~~**`radical check --ratchet` on a folder with conflict markers in
     `relations.json` lowers stale-reference to 0.**~~ ✓ stale-reference 0,
     Ratchet 1 → 0; once the conflict is resolved ✖ (max 0), exit 1. A
     guess: `runCheck`'s "not run" list for no model is built from
     `[...CHECK_RULES, GOAL_RULE]`, and stale-reference is in `FOLDER_RULES`
     (item 161 missed it).
     Fixed 2026-10-21: On a folder that does not read as a model, stale-
     reference is not run either, and --ratchet leaves its baseline.
207. ~~**With a milestone open, Inspector › Changes shows empty rows or the
     milestone's old names.**~~ v1: ADDED 1 empty row, CHANGED 1 with just
     "name"; v4: the milestone's names; the header counts the live model.
     Model quality shows `Relation ""`. A guess: `Inspector.tsx` takes
     `ctx.nodes` from `c4Nodes`, the milestone's, so the chips find nothing.
     Fixed 2026-10-21: With a milestone open the Inspector lists the live
     model's changes, by their names, as its counts do.

*Run 59.* Covered: enum options, required single and many references, Reads
as; type and relation label renames (the wiki follows); parents and maximums
lowered; Reset to C4 with custom types and milestones; MCP
`upsert_node_type` against the editor; a custom metamodel in a folder; a
metamodel edit with a milestone shown (fine). Not covered: a `.radical`
round trip, a type id rename, the Diagram tab, relation pair minimums and
maximums.

208. ~~**An enum option removed while an element holds it shows another
     option, and nothing flags it.**~~ API `tier: silver`, options left gold
     and bronze: the card's select shows "gold" (no empty entry, and gold
     cannot be picked), Validation 0; MCP refuses silver on a write, but
     `get_issues` does not list it. A guess: `AttrValue` in `RightPanel.tsx`
     adds "—" only for an empty value, and `validateModel` has no enum
     check.
     Fixed 2026-10-21: a value that is no option any more is flagged by
     Validation and get_issues, and the card shows it as it is.
209. ~~**Reset to C4 is accepted while a milestone holds an element of a
     custom type.**~~ Restore to live then gives "Node Type1 has unknown type
     type1" (item 124, through Reset). A guess: `checkReplaceMetamodel`
     counts the live model only, without the milestone and view checks
     Delete type has.
     Fixed 2026-10-21: Reset to C4 is refused while a milestone or a view's
     filter holds a type C4 lacks.
210. ~~**MCP `upsert_node_type` on requirement loses its visibleWhen rules.**~~
     Properties sent as `get_model_summary` lists them are refused
     (visibleWhen is an additional property); sent without it they are
     accepted and all 5 visibleWhen rules are gone, so a ubiquitous
     requirement's card shows While in state. Studio's editor keeps them. A
     guess: `PROPERTIES_SCHEMA` in `metamodelTools.ts` lacks `visibleWhen`,
     and `parseProperties` drops it.
     Fixed 2026-10-21: upsert_node_type accepts and keeps a property's
     visibleWhen.
211. ~~**A required many-reference emptied in the card passes Validation.**~~
     Emptied to [], the card shows the required dot and Validation says 0;
     the folder drops [], so the model is flagged again when reopened. A
     guess: `validate.ts` checks `v == null || v === ''` and misses [].
     Fixed 2026-10-21: a required reference emptied to an empty list is
     reported missing.
212. ~~**A type added by hand to a preset folder's `metamodel.json` is
     ignored, and Studio's next save erases it.**~~ The file names the preset
     `c4-ddd-governance-builtin` with the full preset (42 KB) plus the new
     type: an unknown type in Studio and MCP; Studio's save removes it from
     the file, an MCP write keeps it. A guess: `documentMetamodel` swaps a
     stored preset id for the current preset.
     Fixed 2026-10-21: a type added to a preset model's metamodel.json is
     kept, under a custom copy of the preset.

*Run 60.* Covered: ⌘P on 8 view types in 3 perspectives, the Inspector and
the metamodel editor; Quick Search's Enter on every view type; zoom keys
everywhere; Tab order through the toolbar, left panel, card, canvas and 7
dialogs; table cells with Enter, Esc, Tab and undo; the wiki writing line's
keys; Wrap, Move, Align and Hide by keyboard with undo; Shift connect with a
multi-selection. Not covered: ⌘Z in text fields, the agent Forge panel's
keys, Inspector tabs, wizard steps, the slide dock, Ctrl multi-select on
Windows.

213. ~~**Ctrl+Z and F5 reach the model behind the Models, Hub import, AI
     providers and Forge dialogs.**~~ Ctrl+Z on the Models dialog's Close
     undoes a drag (Web App (60, 244) → (30, 120)); F5 with text typed in
     Forge starts a presentation, Forge closes and the text is lost. ⌘P, ⌘+,
     Alt+← and the first Tab reach behind too; in the metamodel editor ⌘P,
     "Ledger", Enter switches the view behind it. `inModalDialog()`
     (Toolbar) looks for `aria-modal`, which only About and the node wizard
     set (item 70 fixed the wizard only); Quick Search's ⌘P and `useNavKeys`
     check no dialog.
     Fixed 2026-10-21: Ctrl/Cmd+Z, F5, ⌘P, ⌘+ and Alt+← do nothing behind
     the Models, Hub import, AI providers and About dialogs, or with the
     focus in Radical Forge, and Tab stays in a dialog.
214. ~~**A ⌘/Ctrl-click without a drag lets the physics rearrange the whole
     view.**~~ Saved, kept by a reload, no undo step: sample System Context 8
     of 8 moved (Core Banking Platform (720, 120) → (397, 576)), Core
     Banking 14 of 14, bookstore 6 of 6; also a ⌘-click multi-select when
     Shift is the connect key. A guess: a zero-length push starts
     `liveGrab`, and `liveRelease(moved = false)` keeps the relaxed
     positions without a step.
     Fixed 2026-10-21: a ⌘/Ctrl-click without a drag moves nothing; the
     physics starts only when the element is dragged.
215. ~~**View, milestone, sequence and metamodel type cards cannot be opened
     by keyboard.**~~ View cards in Viewer and Presenter (none of 22; in
     Designer only View properties), milestone cards and Current (live),
     sequence cards, and metamodel types (`.mm-card-header` is a div with
     onClick).
     Fixed 2026-10-21: view, milestone, sequence and type cards open with
     Enter or Space.
216. ~~**Quick Search's ↓ moves the highlight out of sight.**~~ At 1280×720,
     result 20 is at y 950 under a list ending at 474, scrollTop 0; Enter
     opens a result never seen. `onInputKey` only sets the hover, with no
     `scrollIntoView`.
     Fixed 2026-10-21: the highlighted Quick Search result stays in sight.
217. ~~**⌘+ on a table, wiki, matrix, hierarchy or Warnier view does nothing
     and blocks the browser's zoom.**~~ Back on a canvas, 6 console errors
     (`<circle>` cx NaN, pattern `translate(-NaN)`); on a flow view ⌘0 needs
     a click first. A guess: the hidden canvas keeps its zoom helpers, and
     `zoomIn` on an unmounted React Flow writes NaN.
     Fixed 2026-10-21: ⌘+ off a canvas leaves the browser its zoom and no
     longer breaks the canvas.

*Run 61.* Covered: MCP `remove_alignment` against real drags in an open
Studio (folder), undo across an agent's write; orthogonal lines with
alignments; Smart Layout twice in two fresh pages (the same); Unpin all with
undo; Smart Layout in Viewer and Presenter with milestones (rule 7 held);
Tree Layout on 4 views; Smart Layout on 300 elements interrupted by an add,
a view switch or a reload; labels by zoom. Not covered: Smart Layout
interrupted by a delete, a collapse or an agent's write; alignments with
Propagate and Discard; Unpin all with dense adds; MCP `smart_layout` on the
model of item 219; grids across groups.

218. ~~**A drag inside a group leaves the next group on its system's header,
     and a reload moves it 12 px down.**~~ Sample, Core Banking, API Gateway
     dragged by (60, 40): Risk & Data saved 38 px below Core Banking
     Platform's top; after a reload it and its 3 children are drawn at 242
     instead of 230 while the file keeps 38 (run 64 saw the same for Access
     & Security after a drag of Fraud Detection). A guess: the calm drop's
     frame refit (`liveColaEngine` release → `clearOverlaps`,
     `refreshBounds`) ignores `LIVE_CHILD_TOP_MIN`, which `deriveRFNodes`
     applies after a rebuild.
     Fixed 2026-10-21: a drop inside a group leaves the groups beside it
     below their system's header; a group's frame holds its child groups as
     drawn.
219. ~~**An ordered column across groups stands upside down, and a reload
     scatters it.**~~ Sample: API Gateway on top against the saved order
     [accounts, apigw]; a reload flips them, 11 of 14 elements move, tops
     from −2134 to 4103, 3 overlaps (Access & Security over Banking
     Services, 520×720); Screen Map with a column of 3 mockups: all 23
     elements move to y −10728 … 17214, a group 13981 px tall, 11 overlaps.
     An unordered column holds and a reversed row is kept. A guess:
     `projectGroupAlignments` (`liveColaEngine`) ignores order across
     groups, and on load `enforceAlignments` / `applyAlignments`
     (`constraints.ts`) force it by moving groups and do not converge.
     Fixed 2026-10-21: an ordered row or column across groups moves the
     groups into its order and stands across reloads.
220. ~~**A drag held across Smart Layout's result gives a mid-drag state on
     Undo.**~~ 300 elements, ~10 s: Undo 1 → the start (all 297), Undo 2 → a
     mid-drag state never seen (14 off the start), Redo 1 → the start, Redo
     2 → the layout with the drop. A guess: `liveGrab` captures
     `_beforeDrag`, `runSmartLayout`'s `_pushUndo` snapshots mid-drag, and
     `liveRelease` pushes the pre-grab snapshot on top.
     Fixed 2026-10-21: a drag held while Smart Layout's result lands gives
     two undo steps, the drop and the layout, and never a mid-drag state.

*Run 62.* Covered: parallel, history, final, choice and compound states over
MCP; `get_issues` against Validation; transition card edits with an undo
chain; a compound delete with undo on the injury model; collapse, reload and
view switch; the viewpoints State machine, Entity lifecycles and Event
catalogue; the wiki of a machine; the requirement wizard's Fill in, Back and
Esc; `lifecycle-of` from a table; domains with Alt-drag. Not covered:
compound states in milestones, `implements` next to deletes, the need,
scenario and fitness wizards, `smart_layout` against Studio on state views.

221. ~~**Studio and MCP build statecharts that Validation then flags.**~~
     order-machine: Alt-drag from Cancelled (final) to Pending payment
     ("Final state cannot have outgoing transitions"); Confirmed made final
     in the card's Kind while it has an outgoing transition (Validation 0 →
     1, run 53); Pending → Confirmed's source end dragged onto Cancelled (0
     → 3, run 53); Alt-drag onto the initial pseudostate; an initial
     pseudostate dropped into a parallel state (palette or the wiki's Add:);
     a second state machine under Order from Entity lifecycles' + row. No
     notice; MCP `add_relation` and `update_node` accept with a warning. A
     guess: `checkAddRelation`, `checkPatchRelation` and `checkNodeUpdate`
     (`model.ts`) check allowed pairs and that a final state holds nothing,
     while the statechart rules are only in `validateStateMachines`
     (`statechart.ts`); item 100 did a final state's children only.
     Fixed 2026-10-21: what the statechart rules flag is refused, with the
     reason, in Studio and over MCP.
222. ~~**A container collapsed at its parent's edge moves its surroundings on
     the next view switch or reload.**~~ Ticket lifecycle, Review collapsed
     (the machine 1220 → 1105 wide), All elements and back: 10 of 13 move
     (Review (1003, 388) → (896, 519)), saved; on C4, Shop 770×380 at (0, 0)
     → 650×280 at (−53, 56). A guess: `strayNodeIds` and `effectiveWidth`
     (`geometry.ts` in `packages/layout`) read only the model's `collapsed`,
     not the view's `collapsedNodeIds`, so the centre falls outside the
     shrunk parent and `placeUnplaced` runs (like item 78).
     Fixed 2026-10-21: a container folded on a view keeps its place on a
     view switch and a reload; a node's place is checked at the size the
     view draws it.
223. ~~**The properties card's sentence ignores While in state.**~~ The canvas
     says "While the Order is Confirmed, …", the card "While ‹precondition›,
     …"; with a precondition text the card shows the text. A guess:
     `EarsSentencePreview` in `RightPanel.tsx` does not use
     `requirementStatePhrase` (items 52 and 59 fixed the canvas and the
     wiki).
     Fixed 2026-10-21: the card reads "While the Order is Confirmed, …" like
     the canvas and the wiki.

*Run 63.* Covered: the matrix popup for several relations with undo and
redo, matrix refusals and adds on the Radical metamodel, multi-reference
chips from a matrix selection with undo; hierarchy Size and Levels with
undo; a table rename on a folder during the agent's `add_node`; a table add
in a milestone. Not covered: number fields, the Summary column, sorting next
to adds, hidden relations in a matrix, Viewer and Presenter.

224. ~~**On a hierarchy view the properties card covers Size, Levels and ↑
     Up.**~~ Sample › Platform Hierarchy, 1280 to 1920 px wide: a double-click
     on Core Banking Platform opens the card, and a click on Levels then
     reaches the card; Levels stays 2. A guess: the controls of
     `.treemap-breadcrumb` (`TreemapView`) sit flush right, under
     `aside.right-panel`.
     Fixed 2026-10-21: the hierarchy's Size, Levels and Up stay clear of the
     properties card.
225. ~~**A required property with a default is reported missing while the card
     shows the default.**~~ Transition › Kind (default external) made
     required: Validation says 3 missing (4 after a matrix add); the card
     shows "external" unmarked, and picking "external" stores nothing. A
     guess: `validate.ts` ignores `p.default`, the card's `missing()` uses
     `?? p.default`, and `insertRelation` writes no defaults.
     Fixed 2026-10-21: a required property with a default is not reported
     missing.
226. ~~**In a milestone, a table's + row closes the new element's name after
     the save question.**~~ v4, All elements as a table, + Component under API
     Gateway, Continue editing: the name field is closed, the focus on the
     page body, the typing lost, the row "New Component". Item 104 was fixed
     in Warnier only. A guess: `renderName` in `TableView` commits on blur,
     where `WarnierView` skips while `milestonePromptOpen`.
     Fixed 2026-10-21: In a milestone a table's new row keeps its name open
     through the save question.

*Run 64.* Covered: Save as new, Discard and Propagate after a drag, move,
collapse, alignment, Hide, rename and step note; milestones around the
metamodel editor and Viewer; undo around the choice; the diff toggle and
ghosts; deleting and renaming milestones that slides link;
`compare_milestones` against the chip (+11, +29, +118, the same); a folder
with the agent's milestone tools; Restore to live with undo, redo and
reload. Not covered: alignments propagated, Capture again of milestone
slides, hundreds of elements. Its first finding is item 167; the 12 px shift
after a drag it saw outside its area is item 218.

227. ~~**A milestone saved without sequences shows the live ones, and Save as
     new stores them.**~~ The sample's milestones have no `sequences` key;
     Save as new after a drag stores 4 sequences (17 steps naming relations
     the milestone lacks), with the diff "+23 ~0 −0"; Propagate gives v3 and
     v4 the 4 sequences; with a deleted element "+22 ~0 −2". A guess:
     `selectMilestone` keeps the live sequences when `snap.sequences` is
     absent.
     Fixed 2026-10-21: A milestone saved without sequences shows none, and
     Save as new and Propagate store none.
228. ~~**Delete milestone asks nothing and cannot be undone, and its slides
     show "?".**~~ Undo disabled, Ctrl+Z does nothing; a slide keeps the
     `snapshotId`: a "?" tag, the title "Milestone: undefined", and it shows
     the live 78 elements (also run 56). MCP `delete_milestone` unlinks the
     slides (`milestoneTools.ts`). A guess: `removeSnapshot` pushes no step,
     milestones are not in `_captureState`, and slides are not unlinked.
     Fixed 2026-10-21: Deleting a milestone is an undo step and its slides
     show the live model until it is undone; making and renaming one are
     undo steps too.
229. ~~**A space typed in the "Save as new milestone" name saves at once.**~~
     Typing "Target 2027" saves "Target", and "2027" goes to the canvas. A
     guess: the `<input>` of `MilestoneEditOverlay` lies inside `<button
     class="milestone-option">`.
     Fixed 2026-10-21: A space typed into the new milestone's name is part
     of the name.

To decide (runs 45 to 64): an agent's write while the Inspector is open
clears Designer's undo history (as with the metamodel editor); Undo after
Save as viewpoint leaves the viewpoint, since the metamodel is in no step,
and metamodel edits are no undo steps at all while the manual says
"Everything is undoable"; whether a move takes the element out of alignments
it shares with its new ancestor, or is refused; a view saved without a
`positions` key crashes Studio in `setActiveView` (the radical-diagram
skill's format does not say it is required); whether a collapse in a
milestone is shared layout or a milestone edit (item 170 needs it), and Hide
from view and Unpin all in a milestone change the live view before or
without the prompt; an alignment made in a milestone stays after Discard;
undoing every milestone edit still says unsaved; table, wiki, hierarchy,
matrix and Warnier views show no milestone chip, though the manual says the
chip names it; after Restore to live views keep ids of elements the model
lacks (Screen Map lists 23, draws 3); any reload, also in Viewer and
Presenter, saves the document and its `nodes[].x/y` mirror (19 values after
a collapse in Viewer); zoomed out, a relation line covers a container's −/+
button; a view folder renamed in Studio while the agent puts a view in the
old folder brings the old folder back with only that view; custom types read
back A–Z by id, so the editor's list and the palette change order after a
reload or an agent write; an agent deleting the milestone shown with an
unsaved edit lights up elements it did not change; an empty label in a node
file makes MCP refuse every call naming no file while `radical check` finds
0 errors; `add_node` refuses a label " " but `update_node` accepts " " (file
`person.md`); `get_selection` for a deleted view says All elements, and a
broken or v2 `selection.json` reads as "Studio has not had this folder
open"; `update_relation` stores a relationType "" (Studio stores none); the
properties of an old type stay after a type change and cannot be set over
MCP, and `add_relation` without a type stores unchecked properties with
`get_issues` silent; a read waits 15 s on a fresh garbage lock, then says
"nothing was written"; Structurizr views are not imported (the import lands
on a table), and the import says nothing about what it drops (`this ->`,
archetype elements, `"""` descriptions, a workspace-level `!include` that
loses the whole model, `extends`, deployment); whether the C4 preset should
allow container → component and person → person, as Structurizr does, or the
import refuse them; Enter or Alt+↑/↓ on a top-level process renumbers the
order across processes in different containers, and Warnier and agent adds
at once can share an order; Esc in a playing Warnier slide with a selection
only deselects, and F5 does not stop an F5 presentation; the save after an
add waits longer with size (Warnier: ~10 s at 100 steps, ~34 s at 149, never
at 150 to 200); links the sanitizer emptied (`javascript:`, `data:`) are
drawn as links that do nothing, and a Markdown link to a wiki route opens a
new tab; a one-level chain's Overview lists groups with no heading; the HTML
export puts description headings at h3, the level of the children; PNG
export includes the editing controls; the card's Type select offers
`part-of` between two aggregate roots, shows "(generic)" for a type the pair
does not allow and no Type row when only one fits, so a wrong relation type
cannot be fixed there, and "(generic)", like Alt-drag between two entities,
makes an untyped relation nothing flags; the table's add menu repeats
choices on a level reached both ways; a first-level `via` is kept but
ignored by `create_view`; template records are live-only (in a milestone the
card says 450, the Hub Template section 250); two imports of one concept
give views and sequences the same names; `HubTemplateSection` calls a hook
after an early return; a slide of a deleted view plays the whole model with
`/v/view-core` kept in the address; what Presenter showed stays in Viewer
until a view switch; the sample's Hierarchy slide 8 has no level of its own,
and a double-click on a Hierarchy slide leaves `/e/<id>` in the address for
later slides; a flow numbers the steps left with gaps (3, 4) under "2
steps"; an empty `--report` directory or a non-JUnit `.xml` reads as 0 test
cases (exit 1, overwriting `test-results.json`) where a non-report `.json`
exits 2, and without `--report` report-metric goals are left out of Goals
without a word; Inspector Settings shows Now "—" for stale-reference,
"counted on the folder's files", though Studio counts it; a deep link opens
the Inspector while its button is greyed out; narrowing allowed parents or a
maximum below what exists is accepted (Studio and MCP) with only a
Validation error, while Delete type refuses; a reference switched from many
to one keeps its array (the card shows the first, the wiki all); a Quick
Search pick in a wiki selects but stays on Overview, one deeper than a
hierarchy's Levels does not drill, and one not on the view jumps to the
smallest view that has it (it can be a matrix or flow); the Radical menu and
the selection bar's menus do not answer ↑/↓, and the Radical menu stays open
when Tab leaves it; after Enter or Tab in a table cell the focus goes to the
page body; the hidden right panel's "◀ Back" takes a Tab stop; an element
added during Smart Layout keeps its drop point in the old coordinates (893
px from the nearest on 300 elements); Escape does not clear the canvas
selection; the Delete prompt says "8 node(s) + 10 relation(s)" and removes
10 and 30 (a compound state on injury); a transition's card is titled "No
label" while its line reads "PaymentReceived [ok] / reserve ^OrderPaid";
Event (none) stores `event: ""`; the Event catalogue's summary counts only
`emits`, so an event only raised shows empty; Undo of an earlier step resets
a hierarchy's Size and Levels and saves it; the matrix popup stays under the
clicked cell, with no flip or clamp, also while the matrix scrolls.

Decided 2026-10-21 (the maintainer, on the "To decide" lists of runs 25 to
64): what is done on a view while a milestone is shown (a collapse, Hide
from view, an alignment, pins and Unpin all, a filter, Multi page) is an
edit of the milestone, asked about as a drag is and taken back by Discard;
metamodel edits, Save as viewpoint and Reset to C4 included, are undo steps;
narrowing the metamodel below what the model holds (allowed parents, a
maximum, enum options, required) is done after a confirmation that lists
what it breaks, and the MCP server warns the same way; deleting a relation
or an element removes its sequence steps in the same undo step, and the
Delete prompt counts them; where several relation types fit a pair, Studio
asks for one, and Validation and `get_issues` warn about an untyped relation
where the metamodel has types for the pair; the C4 preset allows container
and web app → component and person → person, and the Structurizr import says
what it could not read and brings in the workspace's views; Apply in the Hub
template section replaces the old value with the new one in the text as it
is now; a model opened from a file or a `?hub=` link opens its first view;
in a merge a delete wins over an edit of the other side, and a child added
into a container the other side deleted brings the container back, each
with a notice; a move takes the element out of alignments it would share
with its new ancestor; an element added during Smart Layout is placed as a
new element once the layout is applied; Quick Search goes to a diagram
before a table, wiki, matrix or flow; a remote image in a Markdown field is
shown as a link and not fetched; without an AI provider the Forge is
disabled; a reload saves nothing by itself; the first layout of a new view
belongs to the step that made the view; `radical check` exits 2 on a report
with no test case; a blank Hub template parameter takes the template's
default in Studio and over MCP; the Models dialog gets Move to browser. Every
other point of these lists is a bug, fixed as the manual and the rules of
`docs/EXPLORATORY-TESTING.md` say.

Fixed 2026-10-21, with the items above: every point of the "To decide"
lists of runs 25 to 64, as decided, except these, still open: Warnier and an
agent adding a process at once can give two the same order (a renumber on
merge is needed); a one-level chain's Overview lists groups with no heading;
a matrix add where several relation types fit still makes an untyped
relation (Validation flags it; the canvas asks); the read-only card opened
from Inspector › Changes with a milestone open shows the milestone's
element; a hierarchy's Size and Levels, a view's type and its line style
changed in a milestone still change the live view; sequence steps of
relations deleted before the fix stay in files until edited; the metamodel
editor shows Undo and Redo buttons that do nothing there. Kept as it is: a
view's positions reach a flow view through `update_view` changing its kind,
as Studio's own type switch keeps a layout.

**Runs 65 to 69, 2026-10-21, commit 9b7060b** (main with the fixes of runs
25 to 64, PR #229), five at the same time. 17 findings, one of them seen by
two runs, each reproduced again by hand; 17 items below. About half are
siblings of earlier fixes: the wiki's relation editor (241, after the card's
and canvas's), Quick Search on a relation (245, after D12 for elements), a
merge's relation ends (234, after Undo's item 127), the viewpoint and
Auto-layout selects in a milestone (230, after the Lines select), a move
during Smart Layout (240, after D11 for adds), opening a milestone saving
(233, after "a reload saves nothing").

*Run 65.* Covered: mixed view edits in a milestone (collapse, column, Hide,
drag) with Undo, Redo, Discard, Save as new and Propagate; a reload among
them; a folder writing nothing until the choice; typing in a milestone;
milestone, view and metamodel edits and New view made in a milestone, then
undone on live; Presenter and F5 with unsaved milestone edits; which model a
slide shows with a milestone open. Not covered: agent slides with `focus`
and milestones, Link milestone with Undo of a delete, Propagate of
alignments and pins, Wiki Multi page and hierarchy in a milestone, hundreds
of elements.

230. ~~**A viewpoint picked in a milestone changes the live view's filter.**~~
     Sample v3, Core Banking, View properties › Viewpoint → Containers ·
     Structure: no question, no "unsaved", the live view is saved with the
     Containers filter (14 → 9 drawn), it stays after Discard and a reload,
     and Undo is disabled after Current (live); on a folder `views.json` is
     written at once. The Auto-layout select does the same (live
     `layoutMode: tree`); a flow's Sequence select by reading the code. The
     Lines select asks, as ruled. A guess: `applyViewpoint`,
     `detachViewpoint`, `setViewLayoutMode` and `setViewSequence`
     (`diagramStore.ts`) do not call `_milestoneViewEdit`.
     Fixed 2026-10-21: A viewpoint, Auto-layout, Sequence, view type, Size
     or Levels set on a view while a milestone is shown is an edit of the
     milestone. It asks the question, is not saved into the live view, and
     Discard takes it back.
231. ~~**Undo after visiting a milestone takes back what was done in it.**~~
     Sample: drag Fraud Detection, show v3, Save as new after a drag (or
     rename v1, rename the view, add a metamodel property), Current (live),
     Ctrl+Z: the drag goes back and the new milestone (the rename, the
     property) with it, saved; any further edit makes it final. A folder
     loses it from `snapshots.json` too. A guess: the parked live entries
     (`_captureState`) hold views, metamodel and snapshots, and
     `_restoreHistoryEntry` puts them back as they were before the visit.
     Fixed 2026-10-21: Undo of a live step after a look at a milestone takes
     back only that step. A milestone made by Save as new, a milestone or
     view renamed, or a type added while the milestone was shown stays.
232. ~~**A slide added on a milestone still shows it after Delete milestone.**~~
     v1 shown on System Context, Presenter › Add slide, Current (live),
     Delete v1: the notice says "the 2 slides that showed it show the live
     model now", but the slide draws v1 (3 drawn, 11 nodes; live 8 of 78).
     The saved slide has `snapshotId: null` and a `modelSnapshot` of 11
     nodes. A guess: `slideModel` falls back to the `modelSnapshot` that
     `addPresentationSlide` captured from the milestone.
     Fixed 2026-10-21: After Delete milestone, the slides that showed it
     show the live model, fitted to their view, with nothing they captured
     on the milestone; Undo gives that back. A slide added or captured on a
     milestone keeps no copy of it, so unlinking it by hand shows the live
     model too.
233. ~~**Opening a milestone saves the live document.**~~ A just-opened sample,
     show any milestone: with no edit, every view's `positions` is trimmed
     to what it draws (62 → 8 … 23), `sys-core`'s y mirror changes (926 →
     120), view-ctx's viewport and `hubTemplates: {}` are written. Nothing
     changes on screen. Also run 69. A guess: `selectMilestone` parks the
     live document through the save path, a sibling of the reload that
     saved (decided: a reload saves nothing).
     Fixed 2026-10-21: Opening a milestone and going back to Current (live)
     writes nothing until the user edits.

*Run 66.* Covered: a delete against an edit (card rename against
`delete_node`, a step note against a relation delete, `set_view_nodes` of a
deleted element, a drag against its container's delete); a child added into
a container the other side deleted, both ways, also against a hand delete,
and Undo afterwards; a reload and agent writes saving nothing; Move to
browser with saves held; Smart Layout against an agent delete. Not covered:
`write.lock` (web build), `base.json` and `get_changes` after merges,
milestones and presentations in a merge, the `radical` CLI.

234. ~~**A merge keeps a relation or a sequence step to what the other side
     deleted.**~~ Bookstore folder, saves held: Studio deletes Payment
     Provider while the agent adds web → payments (or Studio draws customer
     → payments while the agent deletes it): `relations.json` keeps it,
     `get_issues` says "points at 'payments', which is no element of the
     model", the search bar counts 4 relations for 3 drawn, no notice. A
     step the agent adds for a relation Studio deleted stays in
     `sequences.json` (`[r1, r2, r3, r2, r4]`) and `get_issues` is silent. A
     guess: `mergeModels` mends missing parents (`restoreParents`) but not
     relation ends or a step's relation; Undo checks them (item 127).
     Fixed 2026-10-21: In a merge, a relation one side drew to an element
     the other side deleted, and a step one side added for a relation the
     other deleted, are dropped (the delete wins), and the notice names
     them, so the folder, `get_issues` and the canvas agree.
235. ~~**Move to a folder… into another model's folder replaces that model
     without a question.**~~ Two browser models; Bookstore moved to folder
     "model", then Orders to the same folder: no dialog, the folder holds
     Orders' 9 elements, Bookstore exists nowhere any more, and both list
     entries open Orders. A guess: `mayWriteInto` (`documentStore.ts`) asks
     only about folders that are not a Radical model; `createFolderDocument`
     (New model → folder) takes the same path.
     Fixed 2026-10-21: Move to a folder… and New model → In a folder ask
     before writing into a folder that holds another model, naming it; a no
     writes nothing, and on a yes the replaced model's entry leaves the
     list.
236. ~~**An agent's write while Smart Layout computes throws the layout away.**~~
     Injury model as a folder, View 7 (86 drawn), Smart Layout, then
     `update_node` of one description 300 ms later: "The layout was not
     applied: the canvas it was computed for is no longer the one shown",
     nothing of it applied (without the write: 86 of 86 moved). Sample too.
     During a Forge run Smart Layout on a large view cannot finish. Cause
     (checked): `loadDiagram` counts the keepUi reload of an outside change
     in `_modelLoads`, which `layoutTarget` includes (item 3's fix).
     Fixed 2026-10-21: An agent's write reloaded while Smart Layout or the
     tree layout computes no longer drops the layout; it applies to the same
     canvas, an element the write added is placed as a new element, one
     moved into another parent keeps its place by the rule for moves, and a
     deleted one is left out.
237. ~~**An agent mark ahead of Studio's clock holds its saves as long as the
     mark says.**~~ `.radical/agent-activity.json` with `until` 5 min or 1 h
     ahead (a server whose clock runs ahead): a rename is not saved after 61
     s; 14 s ahead, it is saved at 14 s. Cause (checked): `agentWritingUntil`
     caps the mark at now + 15 s on each check, so the hold renews itself.
     Fixed 2026-10-21: An agent mark further ahead than 15 s (a server whose
     clock runs ahead) holds Studio's saves at most 15 s from when Studio
     first sees it.

*Run 67.* Covered: Move to… with rows, pins, model and view folds, then
expand, Undo, Redo and reload; three nested moves on the injury model; moves
across a group of views per element; a collapse in a grid, row and column;
collapse, delete and ⌘ drag during Smart Layout; ⌘ drags at 144 and 168
leaves; Smart Layout twice on the 7 Hub blueprints and 3 injury views (it
stands). Not covered: MCP `move_node` and `smart_layout` against an open
Studio, moves in a milestone, Warnier and wiki moves, ⌘ drags in groups of
views per element, more than 300 elements.

238. ~~**An element moved into a folded container lies outside it after the
     expand.**~~ S2 folded on the view: S1 Move to… S2 saves S1 at (−400, 400)
     in a 600×330 S2; expanding S2 (600×610 at (240, −215)) draws S1 left of
     it, outside its parent, saved; a reload places it beside Q1 instead.
     On a view where S2 is open the same move puts S1 inside at (590, 120).
     A model-level fold gives the same. A guess: `settleMovedNodes` skips
     nodes the canvas shown does not draw, so one under a folded parent
     keeps its rebased offset (the pattern of item 130).
     Fixed 2026-10-21: An element moved into a folded container is placed
     inside it, beside what it holds, as the container opens. After the
     expand it lies inside its parent, and a reload draws it in the same
     place. This holds for a view fold, a model fold and MCP `move_node`.
239. ~~**After a move, a row whose other member stays outside is not held until
     a reload, which moves six elements.**~~ Row [S1, S3] at the root, Move S1
     to S2: the row stays in the constraints (as ruled, S3 is no ancestor)
     but is not held (S1's centre at y 210, S3's at 490); a reload enforces
     it and moves S2, S1, S3, S5, Q0 and Q1 by up to 150 px, while the file
     is unchanged. A guess: `reparentNodes` never calls
     `_enforceLayoutConstraints`.
     Fixed 2026-10-21: After a move, a row or column the element stays in
     holds at once, in Studio and through MCP `move_node`. A reload then
     moves nothing.
240. ~~**An element moved during Smart Layout lands on its new siblings.**~~
     g60 (63 elements), Smart Layout, 300 ms later Move Component 0.1.1 to
     Container 1.0: once applied, Container 1.0 overlaps Container 1.1, or
     the component lies on a new sibling; saved and kept by a reload (5 of 5,
     also on 300 elements). The same move without Smart Layout overlaps
     nothing. A guess: `runSmartLayout` applies the winner's positions to
     every node present at its start; `placeAddedDuringLayout` handles only
     added ids, not reparented ones.
     Fixed 2026-10-21: An element moved into another parent while Smart
     Layout runs keeps its place if that lies inside the new parent and
     clear of what is there; otherwise it goes beside its new siblings, and
     the parent grows with room made around it. Nothing overlaps, and the
     result is the same after a reload.

*Run 68.* Covered: the canvas's relation type menu on entity pairs and a
filtered canvas; MCP `add_relation` warnings and narrowing warnings;
`get_issues` and `radical check` agreeing with Studio; Undo and Redo of a
confirmed narrowing next to a drag; a type's label rename in the wiki,
tables and canvas; the metamodel's Diagram tab with an any-pair type; the
presets' pairs. Not covered: the matrix, table adds along chains, Save as
viewpoint undo next to type edits, milestones holding narrowed values,
folders with Studio and MCP at once, a custom metamodel in a `.radical`
round trip.

241. ~~**The wiki makes relations Validation flags.**~~ Its relation editor
     offers "generic" between two domains (Depends on and Partnership fit),
     and Edit › Add relationship offers Part of… from one aggregate root to
     another; each gives one Validation warning. The canvas and the card
     offer neither. A guess: `WikiView`'s `compatibleTypes` keeps the
     "generic" option and `relationReadingsOf` filters pairs only, without
     the card's `relationTypeKeepsAggregates`.
     Fixed 2026-10-21: The wiki's relation editor offers only the types that
     join the relation's two ends (no "generic"), Add relationship leaves
     out Part of between aggregate roots, and a matrix cell where several
     relation types fit asks which.
242. ~~**Deleting a relation type or Reset to C4 narrows the metamodel without
     the list.**~~ An any-pair relation type lets Orders DB → Customer
     through (database → person); deleting the type asks nothing, Reset to
     C4 asks only "Custom types will be lost"; Validation goes 0 → 1, while
     MCP `delete_relation_type` warns. A guess: only `changeNodeType` and
     `changeRelationType` go through `confirmNarrowing` in
     `MetamodelEditor.tsx`.
     Fixed 2026-10-21: Deleting a relation or node type, Reset to C4 preset,
     and adding a relation type with no pairs ask first and list what they
     would leave against the metamodel, as an edited type does.
243. ~~**Typing an enum's first options asks at each letter.**~~ API holds
     `tier: "gold"`; Container › Add property `tier` (enum), typing "gold,
     silver" into Options opens the narrowing confirmation at "g", "go" and
     "gol" (3 when dismissed). Once in the agent's run and once in the
     re-run the stored options were `["gold", "s"]` while the field showed
     "gold, silver". A guess: `EnumOptionsInput` applies each keystroke that
     keeps the current options, and empty → a set counts as narrowing.
     Fixed 2026-10-21: An enum's first options are taken when the field is
     left, asking at most once, and options being typed when the editor
     closes with Esc are kept as the field showed them.

*Run 69.* Covered: the Structurizr parser on groups, repeated pairs,
unicode, duplicate views and relations, `exclude`, `dynamic *`; in Studio
the first view, reload, Ctrl+Z after an import and the flow view; a `?hub=`
link, fresh and returning; Markdown links and the sanitizer; Quick Search
with view-per-element groups, an element in no view, and a milestone shown.
Not covered: file and folder round trips of an imported model, PNG and SVG
export of imported views, `forge_import_hub_concept` with blank parameters,
Hub template Apply in the browser, the Hub site.

244. ~~**A Markdown image on another host is fetched when written as
     `https:host/x.png`, `\\host/x.png`, `/\host/x.png` or
     `https:/host/x.png`.**~~ Of 8 remote forms in a description, these 4 are
     drawn as `<img>` and requested from evil.example; the other 4 are
     links, as decided. A guess: `MarkdownText`'s `Image` treats as remote
     only a src starting with `//` or `http(s)://`; the browser resolves
     these to another host (`new URL(src, location.href)` would tell).
     Fixed 2026-10-21: An image whose address the browser would resolve to
     another host, in any form (`https:host`, `https:/host`, `\\host`,
     `/\host` as well as `//host` and `http(s)://`), is a link with its
     address and is never fetched.
245. ~~**Quick Search's Enter on a relation opens a view that does not draw
     it.**~~ "browses and orders" (Customer → Web App) from a view without
     Customer opens System Context, where only the folded line
     customer → bookstore is drawn: 0 edges selected, no `/e/`, while the
     result's chips list Containers. A guess: `pickResult`'s edge branch
     calls `pickViewForNode(rel.sourceId)` instead of choosing among the
     views with both ends (D12 covered elements only).
     Fixed 2026-10-21: Quick Search's Enter on a relation opens a view that
     shows both its ends (the view shown when it does), with the relation
     selected.
246. ~~**An imported Structurizr dynamic view plays the first relationship
     between two elements, not the one its step names.**~~ `api -> db "Reads
     orders from"` and `"Writes orders to"`, a dynamic step `api -> db
     "Writes orders to"`: the flow plays "Reads orders from" with the note
     "Writes orders to"; "Writes" is in no flow, and deleting "Reads" takes
     the step away (2 → 1). A guess: the dynamic step lookup in
     `structurizrDsl.ts` matches source and target only.
     Fixed 2026-10-21: A Structurizr dynamic step between two elements with
     several relationships plays the one its description names (else the
     first), not always the first.

To decide (runs 65 to 69): with an any-pair relation type, an Alt-drag
where only it fits makes an untyped relation, unasked, and Validation is
silent; the wiki's Delete prompt does not count relations and sequence steps
as the canvas's does (its Undo is exact); imported Structurizr views leave
out the workspace's groups; the import ignores `workspace { name }` and
never falls back to the file name ("Imported diagram"); a dynamic step
against a relationship's direction (Structurizr's responses) is dropped with
"no relationship between their elements"; a slide with neither a milestone
nor a captured copy shows the milestone picked in Presenter or Designer,
while `slideModel`'s comment says the live model; after Save as new the
canvas shows the view edits but reopening the new milestone shows none
(views are shared), and a reload drops unsaved milestone edits without a
word; typing in a milestone, answering the question and typing on in the
same field makes two undo steps; Viewer and Presenter show Undo and Redo
enabled that do nothing; Redo of "+ New view" stays on the old view; the
Auto-layout select is no undo step, so Undo of a drag before it resets it;
a merge's relation to an element the other side deleted: drop it (delete
wins) or bring the element back, as a container comes back for a new child;
a step conflict's notice says the folder's was kept while the result is
Studio's; a view whose places break containment settles again on every
reload (not saved, as ruled), 44 of 86 on injury View 7; a calm drag of a
component 300 px out of its container leaves the container over the next
one and the component on another (g60, g144, g168: open item 3 of "Calm
drags and pins", or new?); Smart Layout again after one delete moves all 62
elements for "crossings 216 → 221, overdraws 125 → 117 (0% better)".

Decided 2026-10-21 (the maintainer, on the "To decide" list of runs 65 to
69): in a merge, a relation to an element the other side deleted goes, as
does a step of a deleted relation, with a notice (the delete wins); a calm
drag far out of a container is a bug to fix now (a drop leaves nothing
overlapping; closes open item 3 of "Calm drags and pins"); Smart Layout
keeps what stands unless its result is clearly better ("already scores
best"); a view whose places break containment settles on every load and
the settle is saved with the next edit (the reload ruling stands); Save as
new keeps the view edits made in the milestone in the new milestone; while
a milestone has unsaved edits, leaving or reloading the page asks first
(the browser's own question); a slide with neither a milestone nor a
captured copy shows the live model whatever is open; typing into one field
in a milestone is one undo step across the question; Undo and Redo are
hidden in Viewer, Presenter and the metamodel editor; the Auto-layout
select is an undo step of its own; Redo of a new view shows the new view;
where exactly one relation type fits a pair, an any-pair type included, a
new relation gets it, and Validation counts any-pair types when it warns
about an untyped relation; the Structurizr import brings in groups as
`group` elements drawn on its views, names the model after the workspace
and else the file, and imports a dynamic step against a relationship's
direction as a backward step (new: a sequence step can run along its
relation the other way, as a response, and flows and Presenter draw it so);
the wiki's Delete prompt is the canvas's, counting relations and steps,
without "cannot be undone". Every other point of the list is a bug: a step
conflict's notice says which side was kept.

Fixed 2026-10-21, with the items above: every decided point of runs 65 to
69, and three points still open from runs 25 to 64 (the metamodel editor's
Undo and Redo, now hidden there; a matrix add where several relation types
fit, which now asks; a hierarchy's Size and Levels and a view's type changed
in a milestone, now milestone edits). New: a sequence step can run along its
relation backward, as a response (⇄ on the step, `backward` in
`create_sequence` and `update_sequence`, `stepBackward` in `sequences.json`
and `.radical`), drawn dashed from the relation's target to its source.
Still open: a slide of a milestone does not show the milestone's own views,
and Restore to live does not make them live; alignments on All elements made
in a milestone are not kept by Save as new; in Presenter the canvas chip
names the milestone open in the timeline while a slide shows another model,
and picking a milestone while a milestone slide is previewed takes that
slide's model as the live one; groups inside a container are still left out
of a Structurizr import (ADR "Groups inside a system"), and there is no
Structurizr JSON import. To decide: whether adding a relation type with no
pairs to a model whose relations have no type should give them the type
instead of asking; whether Smart Layout should also need a gain above a
criterion's floor (small fixtures still move for an `edgeLengthSd` gain
below 0.25).

**Found by the invariant fuzzer, 2026-10-21, on fix/exploratory-runs-65-69** (`packages/ui/tests/invariants.test.ts`, ADR "Rules checked as invariants"): random action sequences on the bookstore, the sample and a nested model, the rules checked after every step; 22 distinct violations in about 140 000 steps, each reproduced by a plain test that fails, all listed in the test's KNOWN (K1 is the leftover of item 1 and of "Calm drags and pins" item 2, not repeated). Not checked in the browser. Siblings again: 252 after 234, 254 after 127, 257 after 230, 262 after 36, 251 after the fix of "Calm drags and pins" item 3.

247. ~~**A container the physics framed is framed anew on a reload.**~~
     Bookstore: a container dropped into Payment Provider, then Payment
     Provider and Bookstore kept in a row; read again, Bookstore's frame
     moves top 333.5 → 273.8, left −42.1 → −12.3, width 980 → 920, children
     unmoved. Nested: Container 0.0 saved (84, 84) 696 × 376 comes back (30,
     120) 624 × 404. Most frequent (113× in a nested round). Guess: physics
     keeps 60 px over children, load refits with 120 (leftover of item 1).
     Fixed 2026-10-21: A row or column through containers holds as drawn
     after the physics runs, a drop, a fold, a delete or a hide, so a reload
     no longer snaps it and refits every container.
248. ~~**A move or an add leaves other views without a place for the element;
     opening one moves its neighbours.**~~ Payment Provider moved into
     Bookstore on All elements, Containers opened: Customer moves (−179,
     −82), Bookstore 860 → 1360. Delete Orders DB, move API into Payment
     Provider: on Containers Payment Provider 360 × 350 overlaps Bookstore
     by 370 px. Nested: a container added on System 0 view, Systems and
     containers opened: System 0 2440 → 1380 px, moves 588, System 1 moves
     210. System-context view: System 0 into System 1 grows System 1 280 ×
     180 → 360 × 330 over Operator. Guess: placing on every canvas skips
     views that draw through a filter chain.
     Fixed 2026-10-21: An element added or moved into another parent gets
     its place at once on every view laid out before that draws it
     (filter-chain and viewpoint views too), inside its parent beside its
     siblings with room made, so opening such a view later moves nothing;
     and a parent the canvas drew empty grows from its drawn size and makes
     room, instead of growing over its neighbour.
249. ~~**An element dropped where there is no room stays over its
     neighbours.**~~ Person dropped at (359.6, 179.8) ends (284.6, 101) on
     Customer and Bookstore; group at (310, 136) 55 px over Customer. 390×
     in 2000 sample runs.
     Fixed 2026-10-21: An element you add stays where you drop it, and what
     it covers, or what the container it grew covers, is pushed just clear,
     pinned elements too; nothing else moves (decided 2026-10-21). An add
     into a container inside a pinned one pushes what the grown container
     covers clear.
250. ~~**A container drawn without its children is shifted by its next
     rebuild.**~~ API (model 300 × 200, drawn 240 × 160) dragged 81 px: drawn
     x 371, saved 401; a fold draws it 30 right 20 lower, 1 px over Orders
     DB. Filter-chain view: fold Container 2.0 (1000 × 280) jumps (380, 60)
     onto 2.1. Viewpoint view: fold Container 0.2 grows System 0 681 → 1061
     over System 2. Row with API: drag Bookstore 1 px moves Orders DB 55 px
     out of Bookstore. Guess: toggleCollapse shifts by half (model −
     collapsed size) even when already drawn collapsed.
     Fixed 2026-10-21: Folding a container that is drawn without its
     children moves nothing, and rebuilding the layout no longer spreads a
     row's members unseen, so a later drag no longer shows them out of their
     container.
251. ~~**A calm drop onto an element of the same row leaves them
     overlapping.**~~ API and Orders DB in a row, API dragged 196 px right: 56
     px overlap, also after a view switch.
     Fixed 2026-10-21: A calm drop onto a member of the same row pushes that
     member along the row, clear of the dropped one.
252. ~~**A merge keeps an alignment, a fold or a view list entry of an element
     the other side deleted.**~~ Row API–Orders DB, fold of API, or Element
     Table list, unsaved, agent deletes API or Bookstore: merge keeps the
     row, `collapsedNodeIds: ["api"]`, list entries. Sibling of item 234.
     Fixed 2026-10-21: A merge takes out of the views and layout rules what
     one side gave an element, relation or sequence the other side deleted
     (a row, a pin, a fold, a list entry, a hidden relation, a flow's
     sequence); a view's places stay.
253. ~~**Smart Layout logs ELK errors for a relation to an element's own
     container.**~~ API moved into Payment Provider: 11 "[ELK] Layout error …
     UnsupportedGraphException"; applied anyway.
     Fixed 2026-10-21: Smart Layout leaves a relation between an element and
     its own container out of ELK's graph, so it logs no error and the ELK
     candidates take part again.
254. ~~**Undo after an outside change brings back a step whose relation it
     drops.**~~ Delete "browses and orders", agent deletes Bookstore, Undo:
     relations [], Place Order steps ["r1"]. Guess: _withoutStrays does not
     clean sequences. Sibling of 127/234.
     Fixed 2026-10-21: Undo or Redo after an outside change brings back no
     sequence step, row, fold, view entry or hidden relation of what it
     leaves out or what was deleted outside Studio.
255. ~~**Keeping elements already in a row in a row moves their container away
     from them.**~~ Nested Component 0.0.0–0.0.2: System 0 2440 → 3040, moves
     814 left, Component 0.0.2 40 px outside Container 0.0. Row in a
     milestone, Propagate, reload: Container 0.0 at x −703, components at
     80–760.
     Fixed 2026-10-21: Keeping elements in a row or column puts them on the
     line and pushes only what they then cover; elements already on a line
     stay where they are, with their container, also after a reload.
256. ~~**An add on the sample's All elements moves unrelated elements and
     breaks containment.**~~ Component into Fraud Detection: 43 elements move;
     Validate (270, 5696) → (−289, 5887), 220 → 556 wide; child Screen for
     fraud stays outside at (290, 5856).
     Fixed 2026-10-21: An add moves nothing but what the new element, or the
     container it grew, covers.
257. ~~**An element added in a milestone is listed in the live view.**~~
     Context, milestone Early, group dropped: saved live Context lists its
     id, also after Discard. Sibling of 230.
     Fixed 2026-10-21: An element added on a view while a milestone is shown
     is listed only in the view shown; the saved live view does not list it,
     Discard takes it out and Propagate keeps it. The same holds for a
     sequence deleted, and for a flow view made from a sequence of the
     milestone.
258. ~~**Propagate throws after an agent write while a milestone is shown.**~~
     "Cannot perform 'ownKeys' on a proxy that has been revoked" in
     propagatedHubTemplates (diagramStore.ts:945).
     Fixed 2026-10-21: Propagate after an agent's write was reloaded with a
     milestone shown carries the edits into the live model instead of
     throwing.
259. ~~**Folding a system an agent added throws on a view that does not draw
     it.**~~ "reading 'x'" in makeRoomAround (geometry.ts:329). UI
     reachability unchecked.
     Fixed 2026-10-21: Folding or opening an element the view shown does not
     draw (an agent's new system, folded by the assistant or from search)
     only changes the view's fold and moves nothing.
260. ~~**Undo or Redo in a milestone strips a view of its element.**~~ Views of
     "System › containers", Early (no System 2), delete Customer, Undo: view
     of System 2 loses subject and within filter, saved live too. Redo of
     delete of API in a milestone same.
     Fixed 2026-10-21: Undo and Redo in a milestone leave a view of one
     element its element and its filter, also when the milestone lacks that
     element or deleted it.
261. ~~**After an agent deletes a child, the next local layout breaks an
     unrelated container.**~~ Agent deletes Component 1.0.0; fold Container
     2.2; move 2.2.0 into 0.1: System 1 moves (−325, −476), Container 1.0
     520 × 280 → 300 × 260, Component 1.0.1 50 px outside.
     Fixed 2026-10-21: An element the store moved or refitted keeps that
     place when the physics next runs, inside its container.
262. ~~**Undo in a milestone after an agent's write takes part of the write
     back in the live views.**~~ Agent moves Web App into another system;
     group added in milestone; Undo: live Containers has Web App at (30,
     120) again. Sibling of item 36.
     Fixed 2026-10-21: Undo and Redo in a milestone after an agent's write
     take back only the user's steps; the views stay as the agent left them.
263. ~~**In a milestone, an element moved or folded on live since is drawn
     onto its sibling.**~~ Component 1.1.1 moved into Container 2.0,
     Components view laid out, Early opened: 1.1.1 drawn on 1.1.2 at (359.3,
     809.3). Container 0.0 folded on live: in Early drawn 760 wide over 0.1
     and 0.2.
     Fixed 2026-10-21: In a milestone, an element that has another parent
     there than on live, or is open there but folded on live, is drawn
     beside its siblings in its parent (as an added element is) instead of
     at the view's shared place, and the view's layout is not changed
     (decided 2026-10-21).
264. ~~**A merge puts Studio's and the agent's placements on top of each
     other.**~~ Queue dropped into Payment Provider (unsaved) while agent
     moves Orders DB into it: both at (1140, 464.8).
     Fixed 2026-10-21: Where an element the agent placed lands on one placed
     in Studio (a merge of unsaved edits, or Undo after the agent's write),
     it goes beside it in its container, and one the agent grew gets room
     made round it.
265. ~~**The live physics can go on moving for good.**~~ Sample: Auth Service
     folded, component dropped into Accounts Service: after 2500 frames 19
     elements still move, ADR-000 at 21 px/s.
     Fixed 2026-10-21: The live physics stops at the latest 8 seconds after
     it starts (4 with a row or column of containers) and the diagram stands
     as it is then.
266. ~~**Propagate of a delete leaves live sequence steps of the deleted
     relations.**~~ Sample v1: Web Banking deleted, Propagate: Payment
     Processing keeps r-cust-web, r-web-apigw.
     Fixed 2026-10-21: Propagate of a delete takes out the steps of the
     later milestones' and the live sequences that went through the deleted
     relations, with their notes.
267. ~~**An expand on a view that does not draw the children leaves seeds that
     move them later.**~~ Container 2.1 folded/unfolded on Systems and
     containers, then drag Component 0.0.1 on All elements: Component 2.1.0
     jumps (140, 60) out of 2.1, also after reload. Guess: forget() does not
     clear seedPositions.
     Fixed 2026-10-21: Unfolding a container on a view that does not draw
     its children leaves nothing in the physics, so its children no longer
     jump later on another canvas or after a reload.

**Found by the invariant fuzzer while its findings were fixed, 2026-10-21:** with the fuzzer's earlier entries removed and the physics now coming to rest, it reached further. Each is a KNOWN entry of `packages/ui/tests/invariants.test.ts` (the name in brackets), all but K23 seen on the code before the fixes too.

268. **A child an add left outside its parent is placed afresh on a reload,
     and what is near it moves.** The reload side of item 256: a stray child
     from before that fix is placed beside its siblings on load (Core
     Banking 1802 → 1706 px high, Customer (550, 0) → (450, 30) on the
     sample). (K23)
269. **An element added in a milestone and propagated has no place on the
     live view it was added on.** A reload places it. Sibling of item 257.
     (K24)
270. **A row or column of a container and another element is not held when
     the physics stops.** A reload snaps it and refits every container. Next
     to item 255. (K25)
271. **A view of a viewpoint made while a milestone is shown is saved
     without its views per element.** A reload makes them. (K26)
272. **A drag of a container leaves a row or column through an element in it
     off its line.** A reload snaps it. (K27)
273. **Undo or Redo in a milestone after a view switch writes the
     milestone's places into the live view.** Sibling of item 262. The same
     as C2: Undo and Redo in a milestone after a view was first opened there
     put the layout it was opened with into the live view. (K28)
274. **After an agent's write the live model is framed otherwise than a
     reload frames it.** With a milestone shown or not. (K29)
275. **A row or column made in a milestone and propagated does not hold in
     the live model.** A reload snaps it. Next to item 255. (K30)
276. **An add of an element the view shown does not draw grows its parent
     there, off a row or column.** A reload snaps it. Next to item 248.
     (K31)
277. **A table view turned into a canvas draws containers over each other.**
     Also after a move or an add (KB2). (K32)
278. **Undo after an agent's write puts an element back under one the write
     grew.** Next to items 261 and 262; KE1 is the same with Redo: an agent
     adds into a system, Undo and Redo leave it grown over its neighbour.
     (K33)
279. **After a merge with unsaved edits, the next drag shows a container the
     agent grew over its neighbour.** Next to item 264. KB1 is its other
     side: a merge keeps the parent the agent's write refitted around the
     folder's places and the children where Studio has moved them since, one
     outside it. (K34)
280. **A move into another parent, with a row elsewhere, leaves a child of a
     neighbouring container outside it.** Nested model: Container 0.2 folded
     and unfolded, Containers 1.0 and 1.1 in a row, Component 0.2.0 moved
     into Container 0.0: the physics grows Container 0.0 and leaves
     Component 0.1.0 56 px outside Container 0.1 (also C1). (KE2)
281. **A move made where no canvas is shown, then All elements opened: a
     group is framed short of its children.** Sample; not analysed. (KB3)

Fixed 2026-10-21 with the items above: K1, the leftover of item 1 and of
"Calm drags and pins" item 2 (an add into a container inside a pinned one
now pushes what the grown container covers clear). Every fix has a test of
its own, and its KNOWN entry is gone: the fuzzer checks the rule wherever it
applies.

**Found while the fuzzer's fixes were merged, 2026-10-22:** the merge was
fuzzed with new seeds. Fixed then: an element moved or added on one view
gets its place on the other canvases with their rows and columns held there,
so a reload no longer snaps a row and refits every container (a regression
of the fix of item 248); opening on a view a container folded in the model,
whose children the view does not show, makes room for the size it is drawn
at instead of opening over its neighbour; a drop leaves a row or column it
did not touch as it was (one a milestone shows off its line), and what a
line through a container moved along with the drag is pushed clear of what
it would cover (regressions of the fix of item 247); an element moved into
another parent on a view while a milestone is shown is drawn inside its new
parent, beside its siblings, when the milestone's All elements is opened.
Still open:

282. **Undo or Redo in a milestone after an agent's write drops or refits
     All elements' places of live elements in the live document.** Nested
     model; before the fixes only the agent's new element lost its place.
     Next to items 262 and 275. (KM1)
283. **A merge of an agent's write with unsaved edits leaves two siblings
     over each other.** Nested model, seen on the code before the fixes too.
     Next to item 264. (KM2)
284. **After an add and a fold, a move into another parent lets the live
     physics move the old parent over its neighbours.** Sample model, seen
     on the code before the fixes too. Next to item 281. (KM3)

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

### radical check (2026-10-14)

`radical check [folder]` (apps/cli, rules in `@radical/common/check`) checks a
Markdown model folder: its files, the metamodel (the same validator as
Studio's Validation list) and completeness (requirements with scenarios,
accepted ADRs with fitness functions, …), with baselines in
the model folder's `check.json` that `--ratchet` lowers. Scenarios and fitness functions
name their tests in a `tests` property (`file › title`, one per line);
`--report` reads Vitest/Jest JSON, Playwright JSON and JUnit XML and
`--evidence` writes the status of each scenario, fitness function,
requirement and ADR. ADRs "One radical CLI", "Editors prevent, check
detects" and "The model names its tests".

On `architecture/` the 117 `# Covered by:` comments and the fitness
functions' prose became `tests` (2026-10-14). Checked against real reports
first, they held four stale bindings: two titles cut short
(forgeClarify.test.ts, forge.test.ts), a test moved from known-issues.spec.ts
to physics.spec.ts, and "an idle canvas with nested elements stays still",
removed in #176 (now physics.spec.ts › a diagram keeps the layout it is
opened with). With the unit test reports and a Playwright `--list`: 71
requirements and 8 ADRs verified, no errors. Still open:

1. **Checks that are no test runner.** "Installable MCP package"
   (test-package.mjs), "Workspace boundaries" (check-workspaces.mjs), "Smart
   Layout quality" (benchmarks) and "Model in step with code" (review) name
   no tests. A `command` property, or a JUnit report from those scripts,
   would let them count.
2. **The model is checked in CI** (2026-10-14). `architecture/` is
   committed again; the job "Architecture model" runs `radical check` with
   the run's unit and e2e reports and fails on an error
   (`architecture/check.json`). It is not a required check yet.
3. **One catalogue everywhere.** Studio has the Inspector perspective
   (2026-10-14): the whole check on the model as it is edited, the test
   results from `.radical/test-results.json`, links to the elements. Still
   open: markers on the cards in Designer and a "Check" section in the
   properties panel; the metamodel editor's Validation list moving into the
   Inspector; an MCP `run_check` tool for agents. Since 2026-10-16 it has
   three tabs (Model quality, Implementation, Settings), see item 8.
4. **Tests no scenario names** (`test-unbound`, 2026-10-14). On
   `architecture/` with `include: apps/e2e/**`: 86 of 157 e2e tests in 21
   files, among them every test of runs-13-24.spec.ts, wiki.spec.ts,
   metamodel-editor.spec.ts and hub-import.spec.ts. An agent could draft
   the missing scenarios from the titles and the test code over MCP, as the
   first requirements of architecture/ were reverse-engineered.
5. **A renamed test needs its id renamed in the model.** Ids match titles;
   a rename shows as test-not-found in the next run, never silently.
6. **Drift.** Compare the containers' relations with the workspaces'
   dependencies and imports.
7. **`radical mcp` and publishing.** Serve the MCP server as a subcommand
   too, and publish @radicaltools/cli the way the MCP server is published.
8. **Goals and the Inspector's tabs** (2026-10-16, ADR "Goals beside
   baselines"). check.json takes `goals` (least share in percent per metric,
   rule `goal-unmet`); the Inspector shows Model quality and Implementation
   by dimension and edits check.json in Settings, marking a change that
   loosens the gate. Still open:
   - Settings need a check report to be reached: the Inspector button stays
     greyed out without `.radical/test-results.json`, though goals and rules
     about the model need none.
   - `--ratchet` lowers baselines only; raising a goal to the share found now
     (rounded down) would be its counterpart.
   - The Model quality tiles compare with no earlier run: a trend (since the
     last commit, or per milestone) would show whether the model gets better.
   - Results older than a day are flagged, but Studio cannot tell whether the
     code changed since; the commit the reports came from could go into
     test-results.json.
   - Settings cannot be saved for a model that is no folder; offering to keep
     a check.json with it would need DiagramData to carry it (ADR "Check
     settings beside the model" decided against).

### Found by the code audit of the architecture model (2026-10-14)

Rebuilding `architecture/` to match the code (milestones "As-is 2026-10-14"
and "Rebuilt 2026-10-14") meant reading the code area by area. These came up
along the way. They are in the code or the manual, not the model, and none is
fixed yet:

1. **The bundled Hub catalogue fallback probably fails in every build.**
   hubStore falls back to `/hub/` on Studio's own origin. deploy.yml uploads
   only Studio's assets/ and index.html, so CloudFront answers that path with
   index.html. In the desktop app (file://) `/hub/` is the filesystem root.
2. **The desktop CSP may block AI and Hub fetches.** The production policy
   in src/main has no connect-src, so it falls back to 'self'. Not verified
   in a running app.
3. **The VS Code JSON schema is too strict.**
   apps/vscode/schemas/c4.schema.json refuses unknown top-level keys and does
   not list defaultLayoutConstraints or hubTemplates, which Studio writes.
4. ~~**Wiki and table may show empty descriptions in a folder model.**~~
   Fixed on 2026-10-19 (fix/folder-descriptions-loaded): a folder model now
   loads its descriptions with the rest of its files, as it read them all
   anyway; the on-demand loading and the search of unopened descriptions are
   gone.
5. **"Structure view" is still in the UI.** The view card in the left panel
   says Structure view; the canvas caption, the tools and the manual say All
   elements.
6. ~~**The manual claims what the code does not do:**~~ Fixed with the manual rewrite of 2026-10-15 (every chapter checked against the code):
   - "+ New view starts with the elements currently on screen";
   - slides can be reordered, and a Flow slide replays step by step;
   - a click drills into the Hierarchy view (it is a double-click);
   - the metamodel editor sets icon, collapsed size, enum default and
     visible-when;
   - Alt-click adds to the selection;
   - fitness function and requirement fields that do not exist;
   - the VS Code command names;
   - the deep-link mode list leaves out inspector.
7. **get_issues' description calls a disallowed relation pair an error;** the
   validator rates it a warning. The comment at the top of
   apps/mcp/src/forge.ts names three Forge views; there are five.


- **`tableTab` on node types does nothing now** (2026-10-15). The table view lost its tabs per type (it shows the view's chain as a tree with each element's summary), but the metamodel editor's "Own Table View tab" checkbox, `upsert_node_type`'s `tableTab` and the Inspector's mention remain. Remove them, or give the flag a new meaning (e.g. the types offered first in View steps).

### Manual and its screenshots (2026-10-15)

The manual's screenshots are now taken by `npm run docs:screenshots`
(apps/e2e/docs), light and dark, so they can be retaken after every UI change.
Found while doing it:

1. **The sample says it is not laid out.** Opening the Fintech sample shows
   "This diagram is not laid out yet…" on System Context. `looksUnarranged`
   counts overlaps among every element of the model, not only the eight the
   view draws, so a tidy view of a model with stacked hidden elements trips it.
2. **The sample's views look untidy.** System Context has labels over labels and
   long crossing lines; Core Banking and the Hub's Analytical Data Platform
   blueprint are not much better. They are the first thing a visitor sees and
   the pictures in the manual. Run Smart Layout over the sample's views (and
   the blueprints) and save the positions.
3. **The selection bar squeezes its buttons** with *Align children…* in it:
   on a 1440 px window "1 node selected", *Wrap into…*, *Move to…* and *Hide
   from view* wrap onto two or three lines (the properties screenshot shows it).
4. ~~**Presenter leaves an empty strip** on the right where the right panel was.~~
   Gone with the right column (2026-10-16): the properties card lies over the view.
5. **An old MCP server drops new metamodel fields.** A `radical-architecture`
   server built before #195 kept running and rewrote `architecture/`: the
   fitness function's `summary` template disappeared from metamodel.json. A
   server should refuse (or keep unknown fields) rather than write a metamodel
   it does not fully understand.
6. **The C4 copy is named "C4 (built-in) (custom)"** after the first edit: the
   preset's name is "C4 (built-in)" and the fork appends " (custom)".
7. **Undo / Redo look active in Viewer and Presenter** but do nothing there.
8. ~~**README's demo.gif is from before the welcome screen and palette redesign.**~~
   Done: `npm run docs:screenshots` records it, and the social preview too.


### Properties card, palette and All elements (2026-10-16)

The right panel became a properties card over the view, the Elements palette
a bar down the canvas's left side, and All elements a table. Left open:

1. **MCP still arranges a layout Studio no longer shows.** `smart_layout`
   and `align_nodes` / `grid_nodes` without a view work on the model's own
   layout (`defaultPositions`, `defaultLayoutConstraints`), which used to be
   the All elements canvas. Studio shows All elements as a table now, so that
   layout only seeds new canvases. Either drop the no-view form (and say so in
   the tool descriptions and the server instructions, which still speak of
   the "All elements view"), or keep it as the seed and name it that.
2. ~~**No search on tables.**~~ Done (2026-10-18): Quick Search, with its
   Forge button, is in the toolbar on every view; a pick on All elements
   stays there. Filtering the table's rows by the query is still open.
3. **The card covers the right of the canvas.** Shift-click selecting hides
   it, and a click frames the selection beside it, but a drag to an element
   under the card needs ✕ first. A card that steps aside while a drag is under
   way (or turns translucent) would help.
4. **The old sample opens on a table.** The Fintech sample's
   `defaultPositions` (its All elements layout) are no longer shown; a
   structure view of the whole sample ("Landscape") would show the demo model
   drawn in one picture, if wanted.


### Warnier–Orr diagrams, stage 1 (2026-10-18)

Processes and steps in the Radical metamodel and the Warnier view type
(read-only, a click opens the card). Left for stage 2:

1. ~~**Edit in the view.**~~ Done (stage 2, same branch): the bar and the
   keys add, indent, outdent, move, rename, set repeat and children, delete;
   left: dragging to reorder, and editing a chain's tree beyond renaming.
2. **Order by hand.** A step without `order` comes after those with one, by
   name, until an edit in the view numbers its siblings.
3. **Domain multiplicity.** `part-of` has no cardinality, so an aggregate's
   parts read without (1,n).
4. **Export.** SVG/PNG of the diagram, and the CLI export (the tree is pure,
   in @radical/common/warnier).
5. ~~**Forge.**~~ Done (2026-10-18): a Processes stage after the state
   machines, into a Warnier view; the C4 stage adds performed-by.
6. **Large trees.** Every row is drawn; a model with thousands of elements in
   one Warnier view would want folding like the table's.
