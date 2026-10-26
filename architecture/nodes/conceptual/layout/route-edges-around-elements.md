---
id: "0b9c2915-363e-42dd-bb9f-59a64357412c"
type: "requirement"
label: "Route edges around elements"
action: "The canvas shall route that relation around the elements on an obstacle grid with A* path finding instead of drawing the direct line, once the live layout is at rest, entering and leaving the sides of the elements it joins from the front, in the line style of the view: a curved relation as a smooth curve (centripetal Catmull-Rom) through the route pulled tight, an orthogonal one in horizontal and vertical segments; and keep the direct line only when no route is found within the grid limit or the gap beside an end is too narrow for one; the keep-outs behind the elements it joins block the grid unpadded, so a route is found wherever the grid falls."
ears_type: "unwanted-behaviour"
rationale: "An edge running through a box suggests a relation that does not exist. A curved relation used to turn into right angles around a node, so one diagram mixed curves, straight lines and right angles. The keep-outs behind a relation's ends were padded like any obstacle and, on some grid origins set by elements far away, walled in the exit: on the sample's views 31 of 58 relations that needed a route got none, now 4, each ending 43 px from another element (round 185–192, 2026-10-26, F-0076). Evidence: packages/layout/src/edgeRouting.ts (routeAround); packages/layout/src/edgeRouting.ts (computeRoutedEdge, curveThrough, orthogonalConnector); packages/ui/src/components/edges/edgeGeometry.ts; packages/layout/tests/edgeRouting.test.ts; manual#views"
unwanted_condition: "the direct Bézier curve of a relation would pass through an element that is neither its endpoint nor an ancestor or descendant of one"
---
