---
id: "13e85021-36bb-4651-b0b1-d1bddf97980b"
type: "scenario"
label: "A response step is drawn back in a flow"
given: "a sequence of steps on existing relations, played by a Flow view"
metrics: |
  test(apps/e2e/tests/studio/editing.spec.ts › a step turned to run the other way is drawn back as a response, kept, and undone) passed
  test(packages/ui/tests/sequences.test.ts › backward steps (a response along the relation)) passed
  test(packages/common/tests/aiSequenceTools.test.ts › backward steps) passed
  test(packages/common/tests/modelMerge.test.ts › mergeModels › keeps each backward step on its step when a dropped step goes before it) passed
  test(packages/common/tests/modelMerge.test.ts › mergeModels: a sequence's steps and notes › keeps a step turned backward on one side on its step when the other removes a step before it) passed
  test(packages/common/tests/modelMerge.test.ts › mergeModels: a sequence's steps and notes › keeps the backward steps each side added, and none when a side turns the last one forward) passed
  test(packages/common/tests/modelMerge.test.ts › mergeModels: a sequence's steps and notes › says so when a side removes a step the other turned) passed
  test(packages/common/tests/structurizrDsl.test.ts › a dynamic step against its relationship › imports it as a backward step along that relationship, with its description) passed
  test(packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence › keeps a sequence's backward steps in sequences.json; a file without them reads as all forward) passed
then: "the step reads Target → Source (response) and the Flow view draws it dashed from the relation's target back to its source, the canvas numbering it at the target end (↩); the mark is kept after the reload and one Undo takes it back; GET SEQUENCE reports it; each mark stays on its step through merges, deletes and reorders, and a step one side removed while the other turned it is reported; sequences.json keeps it, and a file without marks reads as all forward; the Structurizr step comes in as a backward step along its relationship, with its description"
when: "the user turns one step with ⇄ to run the other way, reloads, and presses Undo; an agent marks a step backward with create_sequence or update_sequence; two writers merge sequences with turned steps; the model is saved to a folder and read back; a Structurizr dynamic step that runs against its relationship is imported"
---
