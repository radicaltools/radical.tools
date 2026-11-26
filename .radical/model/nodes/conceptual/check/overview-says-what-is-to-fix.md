---
id: "bb8b7ee1-a961-48ea-85fa-c5787153f67c"
type: "scenario"
label: "Overview says what is to fix"
given: "a model folder with a failed test, and on its branch a new requirement without a scenario and a new accepted ADR without a fitness function"
then: "it opens on Overview with the scores and, under them, To fix listing the failed test and no warning, and the rail button, the Overview card and the verdict count one to fix; Open shows the element; the \"Debt\" tab lists the warnings by rule with their counts, a group opens to its elements, Add scenario starts a scenario that verifies the requirement, This branch narrows the list, and the verdict leads back to To fix"
when: "the Inspector opens"
---
