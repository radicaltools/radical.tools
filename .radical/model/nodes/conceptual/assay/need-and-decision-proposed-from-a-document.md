---
id: "619ae6a1-4b91-42d8-b511-a398265febdb"
type: "scenario"
label: "Need and decision proposed from a document"
given: "an Assay run with a source document stating a goal and a decision"
then: "nothing is written before the answers; then the need, the ADR with what it constrains and the requirement deriving from that need are in the model, and .radical/assay/run.json keeps their citations"
when: "the agent applies a plan with a need and a decision citing it and a requirement naming that need, then accepts all three"
---
