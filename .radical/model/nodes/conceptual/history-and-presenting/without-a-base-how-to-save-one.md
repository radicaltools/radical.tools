---
id: "5f72c968-5bd0-45bb-afdb-da2ebd7e5069"
type: "scenario"
label: "Without a base, how to save one"
given: "a folder model without .state/base.json, then with one saved two days ago on another branch, then with a malformed one"
then: "without a base This branch says there is nothing to compare with and gives the commands radical hooks install and radical diff --save-base; with the old base it says when and on which branch it was saved and how to save it again; a malformed file counts as no base, and with neither a base nor a report the Inspector is greyed out"
when: "the user opens the Inspector's This branch"
---
