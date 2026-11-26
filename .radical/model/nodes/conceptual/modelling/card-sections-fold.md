---
id: "ea3c033d-3195-4aca-9461-0d7be3b1c55c"
type: "requirement"
label: "Card sections fold"
action: "show the properties card's Verification, Tests and Views sections folded to their heads, each head saying what its section holds (Verification its status, how many of its findings fail the check and how many warn, and Path; Tests how many there are and how many failed, did not run or passed; Views how many show the element), open or fold a section on a click on its head, by Enter and by Space, and keep each section open or folded as the user left it, for every element and across reloads; open, Verification shall show its parts apart, each under a head of its own: the findings first, then the checks, then what checks the element; and a condition a finding of the element is about shall show with that finding only, not again among the checks"
ears_type: "ubiquitous"
rationale: "The three sections filled the lower half of the card and read as one block with the attributes (the user, 2026-11-26, with a scenario's card on screen). A head that says what its section holds answers most looks at the card without opening it. Evidence: packages/ui/src/components/FoldSection.tsx (FoldSection, useCardFolds), ElementVerification.tsx, RightPanel.tsx (ElementTests, ElementViews)"
---
