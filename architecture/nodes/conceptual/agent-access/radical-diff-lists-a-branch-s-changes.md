---
id: "6ea1e526-9670-442a-ab5d-ebafda655b53"
type: "scenario"
label: "radical diff lists a branch's changes"
given: "a model committed on main and a feature branch on which a requirement's action changes and every element moves"
tests: |
  apps/cli/src/diff.test.ts › radical diff
  packages/common/tests/modelChanges.test.ts › model changes
then: "it lists the changed action with its old and new value and the requirement's relations, never a position, for the whole branch whether committed or not; since HEAD nothing; a new folder as all added; a renamed folder against the folder it was; and exits 2 outside git, on the unknown ref and on bad options"
when: "radical diff runs on the folder before and after the change is committed, with --since HEAD and main, as JSON, on a folder the base did not have, on a folder renamed since the base, outside git and with an unknown or option-like ref"
---
