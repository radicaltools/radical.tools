---
id: "233bb577-3387-493f-8221-5f6ff1cf032a"
type: "scenario"
label: "Orthogonal lines judged along their route"
given: "a view drawn with orthogonal lines, where a line's L route passes over an element its straight chord would miss"
metrics: "test(packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › orthogonal lines are judged along their route, bends counted) passed"
then: "the element is counted as covered and the bend as a cost, and the layout moves it off the route"
when: "Smart Layout judges it"
---
