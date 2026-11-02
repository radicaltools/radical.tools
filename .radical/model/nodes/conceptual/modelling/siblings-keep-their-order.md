---
id: "74d28a37-c26c-4bb0-ba9b-2da049bd6ac9"
type: "requirement"
label: "Siblings keep their order"
action: "Studio shall number the siblings it lands among and the ones it left 1, 2, 3, … in the order shown, for the types that have an order"
ears_type: "event-driven"
rationale: "The Markdown folder keeps no order among siblings; a step's order is what places it, so every edit writes it. Evidence: packages/common/src/warnier.ts (renumber)"
trigger: "an element is added, moved, indented or outdented in a Warnier view"
---
