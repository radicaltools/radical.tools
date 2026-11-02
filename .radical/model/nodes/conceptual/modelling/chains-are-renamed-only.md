---
id: "ebea62a2-63fb-4dff-8e00-60cdf64ad3fd"
type: "requirement"
label: "Chains are renamed only"
action: "Studio shall offer only renaming in it, not adding, moving, indenting or outdenting"
ears_type: "unwanted-behaviour"
rationale: "Under a chain an element hangs from another by a relation (a requirement refined from a need), and one level in or out would have to mean another relation; the table adds along a chain. Evidence: packages/common/src/warnier.ts (warnierEditable), packages/ui/src/components/WarnierView.tsx"
unwanted_condition: "the Warnier view draws a chain of relations (two levels or more) rather than containment"
---
