---
id: "b4359e64-9960-4c0b-bff0-7a9fc9b953aa"
type: "scenario"
label: "Outside edit keeps what is open"
given: "a folder model open in Studio with a milestone shown and an edit not saved to it, or a presentation playing on its third slide, or a drag undone after the tab was hidden, or a sequence's card open, or a relation's card open with text being typed into it, or a wiki page title clicked into with nothing typed"
then: "the milestone stays shown with its edit and the agent's change goes to the live model, and when the agent deletes that milestone the highlight compares with the live model; the presentation plays on and Studio reads the change once it stops; the undone drag stays undone; the sequence card stays open unless the sequence is gone; the relation's card stays open with its focus and what was typed; the wiki text shows the agent's edit, and leaving it writes nothing"
when: "an agent writes the folder (and, for the undone drag, the page is reloaded)"
---
