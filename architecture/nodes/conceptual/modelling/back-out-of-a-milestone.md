---
id: "139f98ad-417c-4961-aaf2-4908a50f4ff8"
type: "scenario"
label: "Back out of a milestone"
given: "a milestone shown in Designer, once without and once with unsaved edits"
tests: "apps/studio/tests/routeMilestone.test.ts › milestone in the route › a route without one leaves the milestone shown, and asks first when it has unsaved edits"
then: "Studio leaves the milestone and shows the live model; with unsaved edits it asks first how to keep them"
when: "a route without a milestone is applied, as Back does"
---
