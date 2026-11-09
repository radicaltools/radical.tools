---
id: "ad5d04e0-9a1c-4a72-9c08-595c4fb6bb9b"
type: "requirement"
label: "C4 Interacts pairs"
action: "The C4 preset shall define one Interacts relation type with a technology property whose allowed pairs never end at a group, let a database call a system, container, web app, database, queue or component and a person use a database, never let a database deliver to a person, and take person → person and container or web app → component, as Structurizr models them."
ears_type: "ubiquitous"
rationale: "C4 sets no rule on which elements a relation joins, and a database is a container that may run code: an Oracle package calls a service over UTL_HTTP, a database link reaches another database, an analyst queries one directly. Delivering to a person is a mail server's or a service's. Evidence: packages/common/src/metamodel/presets/c4.ts (interactsPairs); packages/common/tests/databaseCode.test.ts; apps/e2e/tests/studio/editing.spec.ts; manual#relations"
---
