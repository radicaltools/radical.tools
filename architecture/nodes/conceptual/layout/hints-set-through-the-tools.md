---
id: "be334c48-bb30-41a8-b154-869fc554280d"
type: "scenario"
label: "Hints set through the tools"
given: "a custom node type and a custom relation type"
tests: "packages/common/tests/aiDocumentTools.test.ts › metamodel tools › set the layout hints of a node type and a relation type"
then: "the metamodel copy carries the hints, null restores the role's own side, and a role or flow outside the list is refused"
when: "an agent sets layoutRole and layoutSide on the one and layoutFlow and layoutAxis on the other through upsert_node_type and upsert_relation_type"
---
