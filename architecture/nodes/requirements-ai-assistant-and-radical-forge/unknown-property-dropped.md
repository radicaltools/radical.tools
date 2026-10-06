---
id: "d1a3ef2f-487c-48e3-99c6-4eb3b7b60daf"
type: "scenario"
label: "Unknown property dropped"
gherkin: "# Covered by: packages/common/tests/aiToolCatalogue.test.ts › node tools › add_node applies a valid properties bag and drops unknown keys with a note"
given: "the AI adds a requirement with a properties bag that includes a key the requirement type does not define"
then: "the requirement is created with its valid properties and the result tells the model the unknown key was ignored"
when: "the add_node call runs"
---
