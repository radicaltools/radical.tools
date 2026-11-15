---
id: "7e3eb2bb-b51a-48c7-9667-0cc3090c9587"
type: "scenario"
label: "A repository's folder refused"
given: "a folder of other files (package.json, src/), then the same folder with a model in architecture/, then one in .radical/model"
then: "for the folder of other files both ask first, and the no writes nothing; for each folder with a model below it both are refused with a notice naming that model and where it is, and nothing is written"
when: "the user moves a model into it with Move to a folder… and creates a New model in it, declining the question where one is asked"
---
