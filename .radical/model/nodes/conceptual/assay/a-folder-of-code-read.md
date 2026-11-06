---
id: "acb669a6-8cef-45a8-9322-515c9a3b6a77"
type: "scenario"
label: "A folder of code read"
given: "a directory with no .git and no repository inside, holding a Go module"
then: "it is one repository of the run, named by its folder, its module is a unit, its facts are kept in the central repository's .radical/assay/facts/, and nothing is written into it"
when: "it is given to Assay"
---
