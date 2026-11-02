---
id: "3511d81a-58e9-4f89-95b7-7de1143cd578"
type: "requirement"
label: "Concern pack import in Studio"
action: "open a wizard like the node wizard: where it applies (the elements the concern is open for and what contains them, each with what it would cover, the fewest that cover all checked, and every other element it can be bound to, any number of them or none), one step per question whose answer still matters with its answers as cards, the details the answers still use, and a review of the decision, requirements and fitness functions the answers bring; then import that part of the slice, bound to the elements chosen or unbound, as one undo step; for a pack whose types the model's metamodel lacks, say which and offer no import, as the MCP server refuses it"
ears_type: "event-driven"
rationale: "Imported in Studio a pack must arrive as it does over MCP: picked by the answers and bound, so it passes the check and settles its concern. ADR Hub concern packs and critic. Studio imported a pack into a C4 model and its validation then flagged everything it brought (round 170–175, 2026-10-22, F-0009). Evidence: packages/common/src/concerns.ts (metamodelProblem), apps/studio/src/renderer/src/components/ConcernWizard.tsx"
trigger: "the user picks a concern pack in Studio's Hub import dialog"
---
