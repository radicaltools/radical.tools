---
id: "8be2761d-53e9-4ad8-b0ce-6f5e11b800ce"
type: "fitness-fn"
label: "Forge prompts shared"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
metrics: |
  test(apps/mcp/src/forge.test.ts) passed
  test(packages/common/tests/forgePrompts.test.ts) passed
  test(packages/common/tests/forgeClarify.test.ts) passed
scope: "atomic"
trigger: "pull-request"
---

apps/mcp/src/forge.test.ts drives a Forge run over stdio and checks that the stage tasks carry the shared stage prompt, the modelling rules, the need and the user's answers, and that the steps run in order. Studio's wizard imports the same prompts from @radical/common/ai/forge (packages/common/tests/forgePrompts.test.ts, forgeClarify.test.ts).

Threshold: apps/mcp/src/forge.test.ts and the @radical/common Forge tests pass in CI
