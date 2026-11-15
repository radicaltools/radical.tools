---
id: "4e2ace09-537e-4b2d-8739-844f096b98f2"
type: "requirement"
label: "Canvases draw up to 1,000 elements"
action: "Studio shall not draw it nor lay it out, and shall say how many elements it shows, offering to show the view as a table or to narrow its filter; an exploration counts the elements it lists: a view over the limit shall not be switched to Explore (it stays as it is, with its notice), and a + whose choice would take an exploration past the limit shall add nothing, that choice off."
ears_type: "unwanted-behaviour"
rationale: "A view is a filter that grows with the model: one of 300 elements may show 3,000 a year later. The live layout keeps three matrices of the number of elements squared (about 3 million numbers for 1,000 elements, over a billion for 21,000, which ran its worker out of memory and crashed the page), and Smart Layout, label placement and the DOM grow with it too. A table, wiki or matrix shows any number (2026-10-30, the user's decision: a limit of 1,000). An exploration was not counted, so a view switched to Explore, or a + on a need with thousands of requirements, drew them all (F-0141, round 201–210). One check, canvasOverflow in packages/common/src/viewPipeline.ts, serves Studio's notice, Explore and the MCP server's refusals. Evidence: packages/ui/src/components/LargeCanvasNotice.tsx, packages/layout/src/liveColaEngine.ts (CANVAS_MAX_ELEMENTS), packages/common/src/viewPipeline.ts (canvasCount, canvasOverflow)"
unwanted_condition: "a canvas view shows more than 1,000 elements"
---
