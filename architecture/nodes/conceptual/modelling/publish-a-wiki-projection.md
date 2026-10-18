---
id: "6a5747ff-77be-4b9d-9db0-d44c2bbebb62"
type: "scenario"
label: "Publish a wiki projection"
given: "a Radical Markdown folder containing a wiki view and a Confluence Cloud destination"
tests: "apps/cli/src/confluence.test.ts"
then: "only the view's elements are exported with readable fields, chapters and links; the page names Radical as the source of truth; refresh uses the current Confluence version; errors are reported without credentials; the model files stay unchanged"
when: "the user previews the selected wiki and publishes or refreshes its Confluence page"
---
