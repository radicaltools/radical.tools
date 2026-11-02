---
id: "d97f0f33-0039-4102-90b7-f61aad4ee395"
type: "scenario"
label: "Stable folder files"
given: "the same model held in a different in-memory order"
then: "the files are identical, custom frontmatter keys are sorted and JSON sidecars end with a newline; a custom metamodel keeps the order of its types; a file name is cut at 60 characters, never inside one, so the element's file survives the next write"
when: "it is written as a Markdown folder"
---
