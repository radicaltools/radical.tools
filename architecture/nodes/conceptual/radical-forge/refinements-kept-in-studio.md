---
id: "172aa7d9-f51f-4609-9870-944b80661756"
type: "scenario"
label: "Refinements kept in Studio"
given: "a Forge run in Studio with a scripted provider whose requirements stage is done"
tests: "apps/e2e/tests/studio/forge.spec.ts › Forge lists what a stage refined in earlier stages and rejects the unticked ones"
then: "the stage result shows a Refinements panel listing the added requirement and the changed one, and the Domain step on the step bar shows ✎2 in amber with a tooltip naming them; after Reject unticked the earlier requirement has its old action, the added requirement stays, and the step shows ✎1"
when: "the Domain model stage adds a domain and an entity, and also a requirement it found missing and a new action on an earlier requirement, and the user unticks the changed requirement and rejects it"
---
