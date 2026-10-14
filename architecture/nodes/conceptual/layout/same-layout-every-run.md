---
id: "405281c4-5a2c-43e0-9d80-93644d3f5573"
type: "requirement"
label: "Same layout every run"
action: "Smart Layout shall produce the same positions for the same diagram on every run, seeding its annealing from the graph structure and sizing its budgets in units of work rather than time."
ears_type: "ubiquitous"
rationale: "A repeatable result keeps saved models stable in version control and makes layout changes reviewable. Evidence: packages/layout/src/annealing.ts:48-69; packages/layout/src/smartLayout.ts:779-802, packages/layout/src/smartLayout.ts:1242; packages/layout/tests/smartLayout.test.ts:183-187; packages/layout/tests/annealing.test.ts:110-125; apps/e2e/tests/studio/layout.spec.ts:58-72"
---
