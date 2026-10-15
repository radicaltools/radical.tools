---
id: "0b9c2915-363e-42dd-bb9f-59a64357412c"
type: "requirement"
label: "Route edges around elements"
action: "The canvas shall route that relation around the elements on an obstacle grid with A* path finding instead of drawing the direct line, once the live layout is at rest, entering and leaving the sides of the elements it joins from the front, in the line style of the view: a curved relation as a smooth curve (centripetal Catmull-Rom) through the route pulled tight, an orthogonal one in horizontal and vertical segments; and keep the direct line when no route is found within the grid limit."
ears_type: "unwanted-behaviour"
rationale: "An edge running through a box suggests a relation that does not exist. A curved relation used to turn into right angles around a node, so one diagram mixed curves, straight lines and right angles. Evidence: packages/layout/src/edgeRouting.ts (computeRoutedEdge, curveThrough, orthogonalConnector); packages/ui/src/components/edges/edgeGeometry.ts; packages/layout/tests/edgeRouting.test.ts; manual#views"
unwanted_condition: "the direct Bézier curve of a relation would pass through an element that is neither its endpoint nor an ancestor or descendant of one"
---
