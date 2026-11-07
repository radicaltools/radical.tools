---
id: "3fc182c0-42da-4e57-b5a6-fdafff6fe2e1"
type: "scenario"
label: "Text found in a run's repository"
given: "an Assay run over a repository with a folder of thirty map files"
then: "each search returns the lines that hold it with their files and line numbers, the folder search only its own, and the listing shows the thirty files as one line"
when: "the agent searches it for a text, then for a regular expression in one folder, and lists it"
---
