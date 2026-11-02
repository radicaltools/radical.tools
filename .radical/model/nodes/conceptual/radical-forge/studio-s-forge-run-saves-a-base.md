---
id: "ec44ff9b-d2db-4743-ba90-6c9c8ec2a44e"
type: "scenario"
label: "Studio's Forge run saves a base"
given: "a model folder open in Studio with no .state/base.json"
then: ".state/base.json holds the model as it was before the run, marked as a Forge run; Changes on branch counts the need and the requirement as new and its tooltip says they changed since the Forge run began"
when: "the user starts a Forge run and generates the requirements"
---
