---
id: "825b513d-d1f0-40b3-be59-7721cfde2082"
type: "requirement"
label: "Agent builds slide decks"
action: "create, rename and replace presentations whose slides each show one view, whole or zoomed onto focus elements, of the current model or of a milestone, keeping a listed slide's framing captured in Studio unless its view, milestone or focus changes, and refusing focus elements the slide's view does not show"
ears_type: "event-driven"
rationale: "Several slides can zoom onto parts of one view. Evidence: packages/common/src/ai/tools/presentationTools.ts (parseSlides, parseFocus), apps/mcp/src/catalogueTools.test.ts › lays out one view into its own positions and builds a presentation over it"
trigger: "an agent creates or changes a presentation through the AI tools"
---
