---
id: "e8ec2550-c9fd-4fd1-8b5c-cad175fc1e31"
type: "scenario"
label: "Tidying the author's view"
given: "the author's 16-element view as a new model lays it out (a person, two systems, containers with databases, a queue, four ADRs)"
metrics: "test(packages/layout/tests/tidy/tidy.test.ts › Tidy › tidies the author's view) passed"
then: "each database stands right of its container on its row, the ADR that constrains a system stands left of it, the person is above what it uses, the external system is below or right of what calls it, no two siblings overlap, every child is inside its container, and the reader's cost is lower than before"
when: "Tidy runs"
---
