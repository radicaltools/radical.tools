---
id: "0f558e53-7bb9-4b48-ab58-517320695c27"
type: "scenario"
label: "Open concern found"
given: "a model in which a person interacts with a web app of a system, no ADR is marked with the authentication concern, and the Authentication pack is passed to the check"
metrics: |
  test(packages/common/tests/check.test.ts › radical check: concerns › reports a concern its trigger finds and no ADR addresses) passed
  test(apps/cli/src/cli.test.ts › radical check › reports an unaddressed concern from the bundled catalogue) passed
then: "concern-unaddressed reports the authentication concern once, as a warning in the decisions dimension, naming the web app and listing the pack's questions; the CLI finds the pack in the catalogue it bundles"
when: "radical check runs on it"
---
