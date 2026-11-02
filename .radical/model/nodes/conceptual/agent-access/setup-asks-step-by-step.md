---
id: "b61959f6-7779-4149-a98e-2e12bf69b3f4"
type: "scenario"
label: "Setup asks step by step"
given: "a terminal, and a run without one"
metrics: "test(apps/cli/src/setup.test.ts › radical setup › asks step by step in a terminal, and asks nothing without one) passed"
then: "it asks each question with its default and writes only the agents chosen; with no terminal it asks nothing and sets up the agents it finds installed"
when: "radical setup runs with answers typed for the folder, the metamodel, the agents and the hooks, and again with no terminal"
---
