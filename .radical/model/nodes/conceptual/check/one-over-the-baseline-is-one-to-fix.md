---
id: "1c278031-645d-41c4-915b-f8ef17de7e88"
type: "scenario"
label: "One over the baseline is one to fix"
given: "a model folder whose check.json gives requirement-without-scenario a baseline of two, with three requirements without a scenario, one of them added on the branch"
then: "To fix says the rule is one over its baseline of two, shows the requirement of the branch first, marked, with Add scenario, and folds the other two as findings any of which settles it too; the rail button and the verdict count one; and the Debt tab does not list the rule"
when: "the Inspector opens"
---
