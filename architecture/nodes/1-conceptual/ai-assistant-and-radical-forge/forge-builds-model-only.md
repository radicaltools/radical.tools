---
id: "fe81322a-ee81-4eb8-9576-c420557dfe99"
type: "requirement"
label: "Forge builds model only"
action: "Radical Forge shall offer the model only the model-building tools, leaving out the metamodel and presentation tools and refusing any call to them."
ears_type: "ubiquitous"
rationale: "Forge must not change element types or slides, and the omitted schemas save tokens each stage. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:389-394; apps/studio/src/renderer/src/ai/runner.ts:52-55,123,234-241; packages/common/src/ai/tools/index.ts:18-39"
---
