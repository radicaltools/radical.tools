---
id: "13cb9717-6aee-4dbd-8f65-27fecf0fe0e1"
type: "requirement"
label: "Room for labels"
action: "it shall count as a cost a relation label drawn over an element (the elements the line joins included), over a frame's header or over another label, sizing the label as the canvas draws it (the name on up to two lines, the technology below) at the middle of its line."
ears_type: "event-driven"
rationale: "A label over an element hides both; the ensemble already scored label room. Tidy sized labels by a guess of its own and skipped the line's own ends, so it set two related elements closer than their relation's label was wide, and the label lay over both names: on the sample's System Context, 4 labels over elements after Smart Layout with orthogonal lines (round 185–192, 2026-10-26, F-0077). Labels that show only the relation type's name are not counted yet: the sibling gap is too narrow for them (docs/IMPROVEMENTS.md). Evidence: packages/layout/src/tidy/cost.ts, packages/layout/src/edgeLabels.ts (relationLabelSize), packages/layout/tests/tidy/tidy.test.ts"
trigger: "Smart Layout tidies a view"
---
