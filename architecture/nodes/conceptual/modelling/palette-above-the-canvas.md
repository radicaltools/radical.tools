---
id: "fd5442de-d28a-43ca-b0cf-cdbefc46981e"
type: "requirement"
label: "Palette above the canvas"
action: "Studio shall show the Elements palette above the canvas, or above the table: a card centred over it, as wide as its chips need, with one chip per element type with its icon and name, the type's description in the tooltip, grouped under the name of each category, wrapping onto more rows when one row is too narrow, and folded away by its tab on the bottom edge to just that tab, which this browser remembers for both; the side panels' tabs lie over it, and matrix, wiki, treemap and flow views have no palette."
ears_type: "state-driven"
precondition: "a canvas or table view is shown in the Designer perspective and no presentation plays"
rationale: "The left panel holds views and milestones; the types to drop belong with the canvas or table they are dropped on, readable by name without a tooltip, and out of the way when not needed. Evidence: packages/ui/src/components/ElementPalette.tsx (usePaletteCollapsed), packages/ui/src/components/Canvas.tsx (Canvas), packages/ui/src/components/TableView.tsx, packages/ui/src/index.css (.canvas-column, .element-palette, .panel-toggle-top), apps/e2e/tests/studio/editing.spec.ts"
---
