---
id: "145fdd24-0df2-4575-9fa7-a330ef5d1cb5"
type: "scenario"
label: "C4 candidate places actors"
given: "the full sample diagram and a system that calls back into the entry system"
tests: |
  packages/layout/tests/radicalLayout.test.ts › Radical Layout — Full Sample Diagram › METRIC: persons are above all systems (100%)
  packages/layout/tests/radicalLayout.test.ts › Radical Layout — Full Sample Diagram › METRIC: external systems are right of all internal systems
  packages/layout/tests/radicalLayout.test.ts › Radical Layout — Edge Cases › keeps the entry system above the system that calls back into it
then: "every person is above all systems, external systems are right of all internal ones, and the entry system stays above the system that calls back into it"
when: "the Radical Layout candidate lays them out"
---
