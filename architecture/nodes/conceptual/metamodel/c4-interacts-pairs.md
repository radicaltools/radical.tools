---
id: "ad5d04e0-9a1c-4a72-9c08-595c4fb6bb9b"
type: "requirement"
label: "C4 Interacts pairs"
action: "The C4 preset shall define one Interacts relation type with a technology property whose allowed pairs never start at a database or end at a group."
ears_type: "ubiquitous"
rationale: "A passive store never initiates a call, so database → anything is refused. Evidence: packages/common/src/metamodel/presets/c4.ts:118-176; apps/e2e/tests/studio/editing.spec.ts:37-46; manual#relations"
---
