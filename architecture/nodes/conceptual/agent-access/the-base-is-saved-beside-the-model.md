---
id: "dade1e93-8340-4c6e-be16-eb8c15d60bc9"
type: "scenario"
label: "The base is saved beside the model"
given: "a model committed on main and a branch that changes it"
metrics: |
  test(apps/cli/src/diff.test.ts › radical diff › saves the base beside the model) passed
  test(apps/mcp/src/folderModel.test.ts › get_changes) passed
then: ".radical/base.json holds the base commit, how it was chosen, the branch, the time and the model's elements and relations at the base with their positions, .radical/.gitignore keeps it out of git, and no model file changed"
when: "radical diff runs with --save-base, and an agent calls get_changes"
---
