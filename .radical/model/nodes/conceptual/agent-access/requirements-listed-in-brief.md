---
id: "741adce6-2bb2-440d-9924-934f33685364"
type: "scenario"
label: "Requirements listed in brief"
given: "a model with 40 requirements, each with an EARS sentence of 300 characters and a long rationale"
then: "the first answer gives each requirement its id, type, label, parent and its sentence cut to 160 characters with an ellipsis, no rationale, and says GET NODE or FULL gives everything; FULL gives every property as before; the neighbours come once each, in brief, with each relation once"
when: "an agent runs search_model LIST NODES WHERE type = \"requirement\", then the same query with FULL, then GET NEIGHBORS OF one of them"
---
