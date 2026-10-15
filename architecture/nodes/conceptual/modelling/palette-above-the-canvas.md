---
id: "fd5442de-d28a-43ca-b0cf-cdbefc46981e"
type: "requirement"
label: "Palette above the canvas"
action: "Studio shall show the Elements palette above the canvas: a card centred over it, as wide as its chips need, with one chip per element type with its icon and name, the type's description in the tooltip, grouped under the name of each category, wrapping onto more rows when one row is too narrow, and folded away by its tab on the bottom edge to just that tab, which this browser remembers; the side panels' tabs lie over it, and table, matrix, wiki, treemap and flow views have no palette."
ears_type: "state-driven"
precondition: "a canvas view is shown in the Designer perspective and no presentation plays"
rationale: "The left panel holds views and milestones; the types to drop belong with the canvas they are dropped on, readable by name without a tooltip, and out of the way when not needed. The table is for reading and editing what the view's chain gives, so it shows no palette. Evidence: packages/ui/src/components/ElementPalette.tsx (usePaletteCollapsed), packages/ui/src/components/Canvas.tsx (Canvas), packages/ui/src/index.css (.canvas-column, .element-palette, .panel-toggle-top), apps/e2e/tests/studio/editing.spec.ts"
---
