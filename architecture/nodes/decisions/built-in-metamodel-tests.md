---
id: "e7c8c7ff-8512-490c-aeda-9fb3a6367dab"
type: "fitness-fn"
label: "Built-in metamodel tests"
category: "structural"
threshold: "All suites pass in CI"
---

packages/ui/tests/model.test.ts › built-in metamodels: availableMetamodels() offers exactly the Radical metamodel and C4, in that order, and a document saved with c4-ddd-builtin loads as the Radical metamodel with every C4 + DDD type unchanged; apps/e2e/tests/studio/boot.spec.ts (the New model step preselects the Radical metamodel).
