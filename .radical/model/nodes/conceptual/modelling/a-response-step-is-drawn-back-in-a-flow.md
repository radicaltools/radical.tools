---
id: "13e85021-36bb-4651-b0b1-d1bddf97980b"
type: "scenario"
label: "A response step is drawn back in a flow"
given: "a sequence of steps on existing relations, played by a Flow view"
then: "the step reads Target → Source (response) and the Flow view draws it dashed from the relation's target back to its source, the canvas numbering it at the target end (↩); the mark is kept after the reload and one Undo takes it back; GET SEQUENCE reports it; each mark stays on its step through merges, deletes and reorders, and a step one side removed while the other turned it is reported; sequences.json keeps it, and a file without marks reads as all forward; the Structurizr step comes in as a backward step along its relationship, with its description"
when: "the user turns one step with ⇄ to run the other way, reloads, and presses Undo; an agent marks a step backward with create_sequence or update_sequence; two writers merge sequences with turned steps; the model is saved to a folder and read back; a Structurizr dynamic step that runs against its relationship is imported"
---
