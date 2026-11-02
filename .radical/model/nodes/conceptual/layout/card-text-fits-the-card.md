---
id: "fe81ae0b-0991-47fd-8edc-6354a5f9621f"
type: "requirement"
label: "Card text fits the card"
action: "The canvas shall keep an element card's type bar, name (on at most two lines) and technology (on one line, cut with an ellipsis) whole, and show as many whole lines of its description as the room left on the card holds, cutting the last one with an ellipsis and showing none when not one fits."
ears_type: "ubiquitous"
rationale: "In a card lower than its text the description, which fills the card, made the name and technology shrink: half of the name was cut off and the technology drawn over it, and the description stopped in the middle of a line (seen on the Components of a container view of radical.tools' own model, 2026-10-19). NodeDesc measures the room the card leaves and clamps the description to it. Evidence: packages/ui/src/components/nodes/C4Nodes.tsx (NodeDesc), packages/ui/src/index.css (.c4-node-desc, .c4-node > .c4-node-label)"
---
