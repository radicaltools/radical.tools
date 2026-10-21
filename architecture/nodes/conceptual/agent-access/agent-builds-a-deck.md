---
id: "689dc734-cb4f-4fb6-9bc1-9ad13ef7ea6c"
type: "scenario"
label: "Agent builds a deck"
given: "a model with a system inside a view, its containers, and a milestone"
tests: |
  packages/common/tests/aiDocumentTools.test.ts › presentation tools › create, update (keeping a slide) and delete presentations
  packages/common/tests/aiDocumentTools.test.ts › presentation tools › keeps a kept slide's view and framing when viewId is left out
  packages/common/tests/aiDocumentTools.test.ts › presentation focus › zooms slides of one view onto its parts and validates the focus
  packages/common/tests/aiDocumentTools.test.ts › presentation focus › refuses a focus on a slide that shows no canvas
  packages/common/tests/aiDocumentTools.test.ts › milestone tools › let a slide show a milestone, its focus checked against that model
  packages/common/tests/aiDocumentTools.test.ts › milestone tools › re-frame a Studio slide moved to another milestone and unlink slides from a deleted one
  apps/mcp/src/catalogueTools.test.ts › MCP document tools › lays out one view into its own positions and builds a presentation over it
then: "each slide keeps its view, milestone and focus, a kept slide its view and framing when no viewId is given; a slide framed in Studio keeps its camera until its focus or milestone changes; focus elements outside the view, a focus on a slide with no canvas, unknown views and milestones, and a slide listed twice are refused"
when: "an agent creates, renames and updates presentations whose slides show a view, a milestone or focus elements, and deletes one"
---
