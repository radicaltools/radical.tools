---
id: "43a5a0b6-073d-4a5d-be64-9ff5cd99303a"
type: "component"
label: "Hub import"
technology: "React"
---

HubImportModal.tsx, ConcernWizard.tsx and hub/importConcept.ts. Lists the Hub's concern packs with filters by concern group, tag and search text, also from a ?hub=<ids> link, each card naming its group and the questions it asks. Add to Model opens the concern wizard (the node wizard's dialog): where it applies (bindSuggestions, the fewest that cover all checked, and every other element), one question a step whose answer still matters, the details the answers use, and a review of the decision, requirements, fitness functions and sources; importConcernPackIntoDiagram adds the slice the answers pick, bound to the elements chosen or unbound (@radical/common/concerns, buildConcernInsert), as one undo step. Radical Forge's Requirements stage imports its packs through it too.
