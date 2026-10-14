---
id: "e12c3ffe-a052-4c5d-b71f-579aa4d5f765"
type: "scenario"
label: "Wiki glossary"
given: "the sample's Architecture Wiki"
tests: "apps/e2e/tests/studio/wiki.spec.ts › wiki › the glossary says what the types and relations of the model are"
then: "a Glossary page opens saying what a container is and that Interacts reads \"Uses\" and back \"Used by\", and the types the view does not use are only named under \"Not used here\""
when: "the user clicks Glossary"
---
