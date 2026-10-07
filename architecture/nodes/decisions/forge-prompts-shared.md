---
id: "8be2761d-53e9-4ad8-b0ce-6f5e11b800ce"
type: "fitness-fn"
label: "Forge prompts shared"
category: "structural"
threshold: "apps/mcp/src/forge.test.ts and the @radical/common Forge tests pass in CI"
---

apps/mcp/src/forge.test.ts drives a Forge run over stdio and checks that the stage tasks carry the shared stage prompt, the modelling rules, the need and the user's answers, and that the steps run in order. Studio's wizard imports the same prompts from @radical/common/ai/forge (packages/common/tests/forgePrompts.test.ts, forgeClarify.test.ts).
