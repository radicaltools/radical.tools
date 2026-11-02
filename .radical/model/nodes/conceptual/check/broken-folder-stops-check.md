---
id: "6d43c69d-c03b-49c2-84d9-f4ced9848c34"
type: "scenario"
label: "Broken folder stops check"
given: "a model folder without radical.md, with malformed relations.json and a node file holding conflict markers"
then: "it reports folder-manifest, folder-json and folder-conflict with their files, counts no elements and fails, and the CLI exits with status 1"
when: "radical check runs on it"
---
