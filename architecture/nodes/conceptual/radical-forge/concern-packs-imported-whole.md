---
id: "172925c1-4267-40ba-adf5-d6c0eae24a87"
type: "requirement"
label: "Concern packs imported whole"
action: "import each picked concern pack whole for its answers, unbound, before the stage is generated, and tell this and every later stage which concerns are decided, so that it writes no requirement, decision or fitness function of its own for them"
ears_type: "event-driven"
rationale: "One import, done before the stages that would otherwise duplicate it. ADR Forge settles concerns, C4 binds them."
trigger: "the answers of the Requirements stage are confirmed"
---
