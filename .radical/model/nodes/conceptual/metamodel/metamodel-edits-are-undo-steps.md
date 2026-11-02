---
id: "a8f2e310-daf9-4560-bd8f-7933be8b1215"
type: "requirement"
label: "Metamodel edits are undo steps"
action: "Studio shall record the change as one step of Designer's undo history, what is typed into one field of the editor as one step, so that Undo gives back a deleted type together with the steps made before it and their elements and Redo takes it again; setting a type to what it already is makes no step"
ears_type: "event-driven"
rationale: "The maintainer decided on 2026-10-21 (D2, exploratory runs 45 to 64) that metamodel edits are undo steps: outside the history, deleting a type dropped every step that needed it, and a viewpoint deleted in the editor could not be had back. Evidence: packages/ui/src/store/diagramStore.ts (history entries carry the metamodel), apps/studio/src/renderer/src/components/MetamodelEditor.tsx; packages/ui/tests/undoSteps.test.ts"
trigger: "the user changes the metamodel in the metamodel editor (a node or relation type, a property, a viewpoint), saves a view as a viewpoint, or resets the metamodel to the C4 preset"
---
