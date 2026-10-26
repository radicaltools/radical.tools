---
id: "825b513d-d1f0-40b3-be59-7721cfde2082"
type: "requirement"
label: "Agent builds slide decks"
action: "create, rename and replace presentations whose slides each show one view, whole or zoomed onto focus elements, of the current model or of a milestone, keeping a listed slide's view and the framing captured in Studio unless a viewId, its milestone or its focus is given, and refusing focus elements the slide's view does not show (for a slide of a milestone, as that milestone's views draw it, a view it has alone included) and a focus on a slide that shows no canvas"
ears_type: "event-driven"
rationale: "Several slides can zoom onto parts of one view. The tools judged a milestone's slide by the live views, so they refused a focus on what the milestone's view draws and a view the milestone has alone (F-0104, round 193–200, 2026-10-26). Evidence: packages/common/src/ai/tools/presentationTools.ts (parseSlides, parseFocus), apps/mcp/src/catalogueTools.test.ts › lays out one view into its own positions and builds a presentation over it"
trigger: "an agent creates or changes a presentation through the AI tools"
---
