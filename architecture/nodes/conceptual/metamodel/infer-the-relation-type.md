---
id: "8a93c06a-1e5c-4360-b2c6-c16a367ffc97"
type: "requirement"
label: "Infer the relation type"
action: "The system shall set its type to the one restricted relation type that allows the source and target pair and leave it untyped when no type matches; where several types match, Studio's canvas shall ask which one when the relation is drawn (adding nothing when the question is dismissed, and never offering part-of between two aggregate roots), and a relation still left untyped (by an agent or a matrix cell) shall be flagged by Validation and get_issues."
ears_type: "event-driven"
rationale: "Users draw a line and get Constrains, Verifies or Interacts without choosing from a list. Where several types fit, the relation was silently left untyped; the maintainer decided on 2026-10-21 (D5, exploratory runs 45 to 64) that Studio asks for the type on drop and Validation warns about an untyped relation where the metamodel has types for its pair. A matrix add where several types fit still makes an untyped relation (open). Evidence: packages/common/src/model.ts; packages/common/src/metamodel/lookup.ts; packages/common/src/metamodel/validate.ts; packages/ui/src/components/Canvas.tsx (relation type menu); packages/ui/src/components/RightPanel.tsx; manual#relations"
trigger: "a relation is created without a relation type"
---
