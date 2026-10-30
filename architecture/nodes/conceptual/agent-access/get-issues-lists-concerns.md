---
id: "21b1ad5a-77b2-4ff2-bad8-24f3ccab1523"
type: "scenario"
label: "get_issues lists concerns"
given: "a model folder with a web app a person interacts with and no ADR marked with the authentication concern"
metrics: |
  test(apps/mcp/src/folderModel.test.ts › get_issues › lists unaddressed concerns after the metamodel issues) passed
  test(apps/mcp/src/folderModel.test.ts › names a concern pack imported unbound and where to bind it, not to import it again) passed
then: "the first answer lists the authentication concern after the metamodel issues, with the web app, the questions and the pack id; the second does not list it"
when: "the agent calls get_issues, then binds the authentication pack and calls it again"
---
