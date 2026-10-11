---
id: "b9479bf1-d248-471f-8edc-492894163177"
type: "scenario"
label: "Positions restored per view"
gherkin: |
  And the outgoing view keeps the positions it had
  # Covered by: packages/ui/tests/views.test.ts › applies incoming view positions onto c4Nodes when switching
given: "two views whose elements were arranged differently"
then: "the incoming view's saved positions are applied to the elements"
when: "the user switches from one view to the other in the Designer perspective"
---
