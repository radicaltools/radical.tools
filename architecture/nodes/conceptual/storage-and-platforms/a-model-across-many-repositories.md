---
id: "ccd1ab26-ff07-4a21-bb68-1d62c38fbdc3"
type: "need"
label: "A model across many repositories"
kind: "stakeholder-note"
source: "Product owner, 2026-10-17"
---

"How would this model work with 100 code repositories? A central architecture repo, or 100 repos with architecture?" Then: "Focus on the federation for now: what would it take, what is to be done." "So Studio would still see everything as one folder, put together from many?" "Packages... can they be subrepos, like dependencies?"
"Another idea: the radical CLI is responsible for joining the federation into one model to edit, and marks some elements, the external ones, as read-only, so nothing changes in radical itself. The CLI can fetch data from different repos." After the answer (CLI composes and syncs; Studio and MCP only need to refuse edits to external elements and mark them): "OK, create a new branch and build the federation described above."
On 2026-11-01, after a run-through of the federation: "For now work on the limits: dependencies of dependencies are not fetched; Studio does not sync by itself; tables and the wiki let you edit another model's element." Asked one by one, the product owner chose that a model pinned twice is composed at the nearest pin, and that Studio and the MCP server open the model folder itself instead of a composed copy.
Asked whether the other models' views come along, and what happens when two models have views of the same name, the product owner chose both answers proposed, in the same pull request: the other models' views read-only, each model's in a folder of its name, and a copy of one into the model, to edit.
Asked how milestones work in a federation (a milestone kept the other models' elements until the model was read again, then lost them and the lines to them), the product owner chose that a milestone records which versions of the other models were fetched, and shows them as they were, in the same pull request.
After the merge, asked how to set up an example (one model of the organisation's standards, two applications depending on it), the product owner asked for it in radical setup: a step that asks for the models this one depends on, and an option for runs without a terminal, the version offered being the dependency's newest version tag, else its default branch.
Translated from Polish.
