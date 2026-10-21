---
id: "552a8c1f-a9cf-44d1-b918-513fa212e106"
type: "requirement"
label: "Views keep their own positions"
action: "Studio and the MCP server shall keep in a view the positions of only the elements it draws on a canvas (its listed elements, or for a view of a filter chain what the chain gives, and their ancestors), and a view shown as a table, wiki, matrix, hierarchy or flow keeps those it had on its canvas, for when it is drawn on a canvas again; every element's for a view that shows them all; a document that kept more drops the rest when it is opened or first written."
ears_type: "ubiquitous"
rationale: "The canvas keeps one set of positions in the elements, and leaving a view stored every element's into it: in radical.tools' own model (2026-10-14) 26 views held 22,938 positions, 2.4 MB of a 3.9 MB views.json, of which they draw 243, and every switch of view in Studio rewrote them all, a diff of thousands of lines. A view of a chain lists no elements, so it was taken for a view of all of them and kept every position: on 2026-10-19 the 24 views per element grew views.json from 0.8 MB to 2.9 MB. An element added to a view later gets a place there from placeUnplaced instead of a position left by another canvas. Evidence: packages/common/src/c4.ts (viewCanvasPositions, withCanvasPositions), packages/common/src/viewPipeline.ts (viewDrawnIds), packages/ui/src/store/diagramStore.ts (setActiveView, setAppMode, the save, loadDiagram), apps/mcp/src/folderModel.ts (smartLayout, treeLayout, the write path)"
---
