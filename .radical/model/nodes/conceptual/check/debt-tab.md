---
id: "8c833842-103b-45a3-9efc-83e5fd49a832"
type: "requirement"
label: "Debt tab"
action: "it shall list what the check finds that does not fail it: the rules within their baselines, each with its count, its baseline and how far under it the count is, with the way to lower the baselines; the other warnings by rule, those read from test results older than the model said to be so; and the scenarios and fitness functions whose checks nothing ran, with or without measurements, each with its trigger and why (a test the results lack, a metric nothing measured), those run on another event or continually marked as expected there; each rule opening to its findings as To fix draws them, with Open and the fix of one step; and filter the list to the elements changed on this branch or show all"
ears_type: "event-driven"
rationale: "What does not fail the check is debt the team took on, to be read when someone decides to pay some of it, not each time the Inspector opens (the user, 2026-11-26: a separate Debt tab). Evidence: apps/studio/src/renderer/src/components/inspector/DebtTab.tsx, attention.ts"
trigger: "the user opens the Inspector's \"Debt\" tab, a card of the left panel with the count of what it holds"
---
