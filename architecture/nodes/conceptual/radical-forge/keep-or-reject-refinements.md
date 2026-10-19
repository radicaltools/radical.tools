---
id: "22418a18-7acd-45b7-a7de-790d90cda253"
type: "requirement"
label: "Keep or reject refinements"
action: "Radical Forge shall list those refinements and let the user keep them all, reject the chosen ones (an added element or link is removed, a changed one gets its old values back) or reject them all, and Regenerate shall undo the changes of the stage's previous attempt as well as its additions"
ears_type: "event-driven"
rationale: "The stage adds what the brief implies right away, so the run keeps moving, and the user consents afterwards on a short list rather than on every gap. A deletion is listed but cannot be rejected: the prompt forbids it. Evidence: packages/common/src/ai/forge/refinements.ts; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (Refinements panel); apps/mcp/src/forge.ts (forge_complete_stage, forge_reject_refinements)"
trigger: "a Forge stage has finished and it added elements of the types of earlier stages, linked elements that were there before, or changed or deleted elements that were there before"
---
