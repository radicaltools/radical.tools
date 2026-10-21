---
id: "8a93c06a-1e5c-4360-b2c6-c16a367ffc97"
type: "requirement"
label: "Infer the relation type"
action: "The system shall set its type to the one relation type that fits the source and target pair, a type with no pairs fitting every pair, and leave it untyped when no type fits; where several types fit, Studio's canvas and a matrix cell shall ask which one when the relation is made (adding nothing when the question is dismissed, and never offering part-of between two aggregate roots), and a relation still left untyped (by an agent) shall be flagged by Validation and get_issues wherever a type fits its pair, an any-pair type included."
ears_type: "event-driven"
rationale: "Users draw a line and get Constrains, Verifies or Interacts without choosing from a list. Where several types fit, the relation was silently left untyped; the maintainer decided on 2026-10-21 (D5, exploratory runs 45 to 64) that Studio asks for the type on drop and Validation warns about an untyped relation where the metamodel has types for its pair. Exploratory runs 65 to 69 (2026-10-21) found a relation type with no pairs left out of the inference and of the Validation check, and a matrix add where several types fit still making an untyped relation; both are closed. Evidence: packages/common/src/model.ts; packages/common/src/metamodel/lookup.ts (relationTypesFitting, inferRelationType); packages/common/src/metamodel/validate.ts; packages/ui/src/store/diagramStore.ts (connectNodes); packages/ui/src/components/Canvas.tsx (relation type menu); apps/studio/src/renderer/src/components/MatrixView.tsx; packages/ui/src/components/RightPanel.tsx; manual#relations"
trigger: "a relation is created without a relation type"
---
