---
id: "9f1013dd-241c-4880-a938-d18ef939fe2e"
type: "requirement"
label: "Room for a line"
action: "it shall give each line, measured as the canvas draws it from port to port, room for its label (as far as the label reaches along the line) and an arrowhead at each end: a shorter line counts as a cost, two elements (or the frames holding them) whose line has no such room are slid apart along it, and an element put beside one it has a line to is put at least that far off."
ears_type: "event-driven"
rationale: "The siblings' gap (20 px in a frame, 40 px at the top) left a relation's label over both elements it joins and no arrowhead to see; on the sample's System Context a horizontal line of 65 px held a 'Card authorisation' label (the author's screenshot, 2026-10-26: \"zbyt blisko są elementy... strzałki się nie mieszczą\"). Over 22 bench models lines too short for their labels fell from 121.7 to 19.6, crossings 111 to 90, lines over elements 253 to 206; slanted lines rose 245 to 272 and the area 7 %. The closing passes now gather loose elements to the margin only where that does not make the diagram worse: a margin taken at a loss was won back by the moves after it, round and round (334 moves on the Forge run lifecycle view, 312 again on every later run). Evidence: packages/layout/src/tidy/cost.ts (cramped, lineNeeds), packages/layout/src/tidy/moves.ts (room), packages/layout/src/tidy/layout.ts (lineGapOf), packages/layout/src/tidy/index.ts (gather judged)"
trigger: "Smart Layout tidies a view"
---
