---
id: "9de03d6d-407f-45c9-b2d8-9ceab31dc074"
type: "fitness-fn"
label: "Forge refinement tests"
category: "structural"
tests: |
  packages/common/tests/forgeRefinements.test.ts
  apps/mcp/src/forge.test.ts › lists what a stage refined in earlier stages, rejects the chosen refinements, and regenerate undoes the rest
  apps/e2e/tests/studio/forge.spec.ts › Forge lists what a stage refined in earlier stages and rejects the unticked ones
threshold: "All suites pass in CI"
---

packages/common/tests/forgeRefinements.test.ts checks what counts as a refinement, rejecting it and the stage-aware gaps; apps/mcp/src/forge.test.ts drives the refinements and the Review stage over stdio; apps/e2e/tests/studio/forge.spec.ts the Refinements panel in Studio.
