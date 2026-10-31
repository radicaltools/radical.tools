---
id: "0c8746d9-8f7a-4b76-81a2-a7f8bf22bc0a"
type: "requirement"
label: "Needs attention first"
action: "it shall list what needs attention, errors before warnings, each rule as one group that says what it means with its count and baseline, opening to the elements it names, each with Open and, where the fix is one step (a requirement without a scenario, an accepted ADR without a fitness function, an unaddressed concern), the action that starts it; list as one more group the scenarios and fitness functions whose checks nothing ran, with or without measurements, each with its trigger and why (a test the results lack, a metric nothing measured), those run on another event or continually marked as expected there; and filter the list to the elements changed on this branch or show all"
ears_type: "event-driven"
rationale: "A person opens the Inspector to know what to do next; ninety-five warnings in one block by rule told them nothing (the user, 2026-10-31: by severity, then rule; Open and one fixing action). Evidence: apps/studio/src/renderer/src/components/inspector/OverviewTab.tsx, shared.tsx"
trigger: "the user opens the Inspector's Overview"
---
