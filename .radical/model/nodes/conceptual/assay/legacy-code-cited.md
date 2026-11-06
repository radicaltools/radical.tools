---
id: "64ae7b45-dedd-419d-aca7-45523f4c4516"
type: "scenario"
label: "Legacy code cited"
given: "a VB6 repository, of which Assay reads no units, beside a central model"
then: "the first plan is refused naming the quotation, the second is written as inferred, its citation is kept in .radical/assay/run.json and the repository's .radical/radical.json maps the container to the folder"
when: "the agent applies a plan whose container quotes the project's .vbp and names its folder, once with a quotation the file does not have and once with one it has"
---
