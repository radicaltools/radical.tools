---
id: "fd5442de-d28a-43ca-b0cf-cdbefc46981e"
type: "requirement"
label: "Palette down the canvas's side"
action: "Studio shall show the Elements palette down the canvas's left side, always: a card over the canvas, which keeps its size, with one element type to a row, its icon and name, the type's description in the tooltip, grouped under the name of each category and scrolling when the canvas is lower than it; Fit All and the framing of a selection shall fit the canvas beside it; and table, matrix, wiki, treemap and flow views shall have no palette."
ears_type: "state-driven"
precondition: "a canvas view is shown in the Designer perspective and no presentation plays"
rationale: "The left panel holds views, milestones and sequences; the types to drop belong with the canvas they are dropped on, readable by name without a tooltip and always at hand while drawing. Across the top it was cut off by the properties card, so it stands down the left side, one type to a row, without the tab that folded it away. The table is for reading and editing what the view's chain gives, so it shows no palette. Evidence: packages/ui/src/components/ElementPalette.tsx, packages/ui/src/components/Canvas.tsx (Canvas, viewportInFree), packages/ui/src/components/propertiesCover.ts (paletteCover), packages/ui/src/index.css (.element-palette, .palette-item), apps/e2e/tests/studio/editing.spec.ts"
---
