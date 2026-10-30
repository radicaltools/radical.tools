---
id: "9de03d6d-407f-45c9-b2d8-9ceab31dc074"
type: "fitness-fn"
label: "Forge refinement tests"
category: "structural"
metrics: |
  test(packages/common/tests/forgeRefinements.test.ts) passed
  test(packages/common/tests/forgeProposals.test.ts) passed
  test(apps/mcp/src/forge.test.ts › asks the user before each refinement, applies what they accept, and regenerate undoes it) passed
  test(apps/e2e/tests/studio/forge.spec.ts › Forge asks before it refines an earlier stage and applies only what the user accepts) passed
---

packages/common/tests/forgeRefinements.test.ts checks what counts as a refinement, taking it back and the stage-aware gaps; packages/common/tests/forgeProposals.test.ts how a proposal is described, applied all or nothing, and the guard against direct writes; apps/mcp/src/forge.test.ts drives the proposals and the Review stage over stdio; apps/e2e/tests/studio/forge.spec.ts the proposal card in Studio.

Threshold: All suites pass in CI
