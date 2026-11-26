---
id: "306c10e3-119c-48c4-bd37-716c5966851d"
type: "requirement"
label: "Counts what is to settle"
action: "count, on the Inspector's rail button, in its head in the left panel, on its Overview card, on the score of each dimension and in its verdict, the findings to be settled for the check to pass: for a rule over its baseline the number over it, for a rule without a baseline each cause of its errors, and one for each goal not met; show and count as one the findings that one cause brings (a test several scenarios name, a metric condition several elements state of the same measurement), with every element that names it and all it leaves unverified; name no warnings in the verdict; and say in the tooltips how many errors radical check counts when that differs"
ears_type: "ubiquitous"
rationale: "One finding over a baseline makes every finding of its rule an error, so one new requirement without a scenario showed as fifty-five errors, of which one is to be settled (the user, 2026-11-26: count what has to be settled). radical check keeps its count: the gate does not change. Evidence: apps/studio/src/renderer/src/components/inspector/toFix.ts (toFix, toSettle), Inspector.tsx (Verdict, SideNav), Toolbar.tsx (InspectorRailButton)"
---
