---
id: "66e31ca1-6161-4254-9e67-179a62b9a399"
type: "requirement"
label: "Large tables stay responsive"
action: "Studio shall work out the table's + rows within 200 ms for 1,000 rows, checking each link a + row offers against the model without copying the model's elements."
ears_type: "event-driven"
rationale: "On a model of 21,000 elements the Traceability table froze Studio for 28 s, a Quick Search pick that opened a table for 36 s, and each letter typed in the card while a large table was shown for 39 s: for each row's + the relation rules were asked about a new element in a copy of all 21,000 elements (2026-10-30). Evidence: packages/common/src/relationRules.ts (linkRefusal), packages/common/src/viewPipeline.ts (addChoices), packages/ui/src/components/TableView.tsx"
trigger: "a table view of a model of 20,000 elements is shown, or the model changes while it is"
---
