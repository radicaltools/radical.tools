---
id: "77e18ea3-eff8-4f86-b64c-f32b1a66ab80"
type: "requirement"
label: "Needs become requirements"
action: "The AI assistant shall create new EARS requirement nodes linked to the need with derives and leave the need's text unchanged."
ears_type: "event-driven"
rationale: "The raw input stays as written while the requirements trace back to it. Evidence: apps/studio/src/renderer/src/ai/systemPrompt.ts:19-20; manual#ai"
trigger: "the user asks the assistant to turn a need into requirements"
---
