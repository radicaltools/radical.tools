---
id: "b852859c-e339-4c2f-8334-d276a6a50365"
type: "requirement"
label: "Eleven-engine candidate ensemble"
action: "Smart Layout shall generate candidate layouts from eleven structurally different engines: five ELK layered variants, two layered variants that pack groups of many sparsely linked elements as compact blocks, a metamodel-aware layered layout, stress majorisation, force-directed and Mr.Tree (the semantic C4 layout left the ensemble when Tidy took over its conventions)."
ears_type: "event-driven"
rationale: "No single algorithm suits every graph shape, so running several families and picking among them is what makes one button work on any view. The engines vary only the top level of a nested diagram; inside groups every ELK candidate laid out the same layers, which turned the domains of radical.tools' own model into long sparse rows (twenty times the area of their elements). Evidence: packages/layout/src/smartLayout.ts (runSmartLayoutELKPhase), packages/layout/src/elkLayout.ts (packSparseGroups, linkedOrder), packages/layout/tests/packedGroups.test.ts, packages/layout/bench/nestedLayout.bench.mts; manual#layout"
trigger: "the user clicks Smart Layout on a canvas view set to the Ensemble mode"
---
