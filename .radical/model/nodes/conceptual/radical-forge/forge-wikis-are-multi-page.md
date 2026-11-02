---
id: "db2cdde1-373c-414c-9e7e-c8dd99929147"
type: "scenario"
label: "Forge wikis are Multi page"
given: "a Forge run with the Radical structure as preselected and a model with a wiki view of the viewpoint Decision log of its own, in Single page"
metrics: "test(packages/common/tests/forgeViews.test.ts › radical structure › makes its wiki views Multi page, five levels deep, and leaves the model's as they are) passed"
then: "the Specification view it makes is Multi page with Depth 5; the model's own Decision log view is reused and stays in Single page"
when: "its stages add a need and an ADR"
---
