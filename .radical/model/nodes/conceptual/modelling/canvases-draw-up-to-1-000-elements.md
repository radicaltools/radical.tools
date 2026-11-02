---
id: "4e2ace09-537e-4b2d-8739-844f096b98f2"
type: "requirement"
label: "Canvases draw up to 1,000 elements"
action: "Studio shall not draw it nor lay it out, and shall say how many elements it shows, offering to show the view as a table or to narrow its filter."
ears_type: "unwanted-behaviour"
rationale: "A view is a filter that grows with the model: one of 300 elements may show 3,000 a year later. The live layout keeps three matrices of the number of elements squared (about 3 million numbers for 1,000 elements, over a billion for 21,000, which ran its worker out of memory and crashed the page), and Smart Layout, label placement and the DOM grow with it too. A table, wiki or matrix shows any number (2026-10-30, the user's decision: a limit of 1,000). Evidence: packages/ui/src/components/LargeCanvasNotice.tsx, packages/layout/src/liveColaEngine.ts (CANVAS_MAX_ELEMENTS)"
unwanted_condition: "a canvas view shows more than 1,000 elements"
---
