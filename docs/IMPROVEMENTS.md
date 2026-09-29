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
