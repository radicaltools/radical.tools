---
id: "5ea11254-f25c-4d94-8853-6703d16cb290"
type: "fitness-fn"
label: "Repository mapping tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
metrics: |
  test(packages/node-files/tests/repositoryLayout.test.ts › repository mapping) passed
  test(packages/common/tests/repositoryMapping.test.ts) passed
  test(apps/cli/src/sense.test.ts › radical sense run › gives a repository's sensor the element's paths from .radical/radical.json) passed
  test(apps/cli/src/implement.test.ts) passed
scope: "atomic"
trigger: "pull-request"
---

packages/node-files/tests/repositoryLayout.test.ts (reading .radical/radical.json, nearest mapped ancestor), packages/common/tests/repositoryMapping.test.ts (the repository-mapping rule), the sense test that gives a sensor element.paths and the setup --status test.
