---
id: "658a2ad4-4716-492d-b281-44356a1c54ee"
type: "scenario"
label: "Forge cannot edit metamodel"
gherkin: |
  And the metamodel and presentation tools are not in the request
  # Covered by: apps/studio/tests/aiRunner.test.ts › runAIPrompt — tool groups and metamodel changes › leaves excluded groups out of the request and refuses calls to them
given: "a Forge stage is generating"
then: "the call is refused as an unknown tool and the metamodel is unchanged"
when: "the model calls a metamodel tool such as upsert_node_type"
---
