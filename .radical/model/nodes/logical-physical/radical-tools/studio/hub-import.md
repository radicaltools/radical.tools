---
id: "43a5a0b6-073d-4a5d-be64-9ff5cd99303a"
type: "component"
label: "Hub import"
technology: "React"
---

HubImportModal.tsx, ConcernWizard.tsx and hub/importConcept.ts. Lists the Hub's concern packs in the concern wizard's frame, one size for every group: the concern groups on the side, each with how many packs match the search text, and in front the group's description, the search and the packs, each naming its group and the questions it asks. Add to Model opens the concern wizard (the node wizard's dialog): where it applies (bindSuggestions, the fewest that cover all checked, and every other element), one question a step whose answer still matters, the details the answers use, and a review of the decision, requirements and fitness functions; importConcernPackIntoDiagram adds the slice the answers pick, bound to the elements chosen or unbound, and the pack's view in the folder Concerns (@radical/common/concerns, buildConcernInsert), as one undo step. Opened for packs (a ?hub=<ids> link, or the Inspector's concern with its element) it starts the first pack's wizard by itself and, after each import, the next one's ("Pack 2 of 3"). Radical Forge's Requirements stage imports its packs through it too.
