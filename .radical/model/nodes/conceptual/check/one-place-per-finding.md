---
id: "cde7977b-ba61-4070-b1ca-4d024467d6f2"
type: "requirement"
label: "One place per finding"
action: "show each finding in one place of the Inspector, an error in To fix and a warning in Debt: the Model and Implementation tabs shall list no findings and keep the analysis (the scores, the traceability chain, the gaps by group, the goals and baselines, the funnels, the coverage by architecture element, and under Not passing the scenarios and fitness functions that do not pass with what they leave unverified), and a link of the traceability chain that falls short shall open its rule's findings, in To fix when the rule fails the check and in Debt when it does not"
ears_type: "ubiquitous"
rationale: "A finding was drawn in three ways, and an error up to three times: on the Overview with Open and its fix, under Errors on its tab without them, and under Findings by dimension by the rule's id; Needs attention named two different lists (the user, 2026-11-26: remove the lists, keep the analysis). Evidence: apps/studio/src/renderer/src/components/inspector/ModelTab.tsx, ImplementationTab.tsx, shared.tsx (FindingRow), Inspector.tsx (showRule)"
---
