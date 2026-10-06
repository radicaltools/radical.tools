---
id: "61f11edd-4cac-4a24-8bfe-dbea2a53d08f"
type: "requirement"
label: "Why-this-layout report"
action: "Studio shall offer a \"Why this layout?\" report that lists every candidate with its composite score, rendered crossings and overdraws, marks the winner, and shows the crossings before and after, the planarity verdict and the annealing cost change."
ears_type: "event-driven"
rationale: "Explaining the choice is what makes an automatic layout trustworthy and tunable. Evidence: packages/ui/src/components/SmartLayoutButton.tsx:55-127, packages/ui/src/components/SmartLayoutButton.tsx:161-163; packages/ui/src/store/diagramStore.ts:2928-2985; packages/layout/src/smartLayout.ts:687-766"
trigger: "Smart Layout has applied a new layout"
---
