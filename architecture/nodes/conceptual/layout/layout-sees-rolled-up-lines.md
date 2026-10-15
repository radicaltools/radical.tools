---
id: "d11dad6c-ee2b-408d-8760-98fc8815e346"
type: "scenario"
label: "Layout sees rolled-up lines"
given: "a view listing Studio and common, two of whose unlisted components use common, and two relations between Studio and common themselves; two relations between two shown elements; two orthogonal routes along one stretch of line"
tests: "packages/layout/tests/drawnLines.test.ts › the lines a layout sees"
then: "the input holds the two direct relations and one rolled-up line labelled \"renders with\" and \"keeps the model with\"; both relations between the shown elements stay lines of their own; the two routes are at least 7 px apart along the stretch, still horizontal, their ports where they were"
when: "the layout input of the view is built, the relations are projected, and the routes are spread"
---
