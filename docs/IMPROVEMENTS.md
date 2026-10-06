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
15. **Bundling parallel relations** — when A↔B has 3 relations, render them as a visual "bundle".

### Milestones (architecture over time)

16. **Side-by-side diff view** — what changed between v3 and v5: added/removed/changed nodes, highlighted on canvas.
17. **Auto-milestone** — every X edits or "milestone on save" so the user does not need to remember.
18. **Notes / changelog per milestone** — "what changed and why" field.
19. **Branching milestones** — experimental architecture variant as a "branch" off v3, with optional merge.

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
   canvas state, so Studio fits the slide's view; framing is captured only in
   Studio.
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
