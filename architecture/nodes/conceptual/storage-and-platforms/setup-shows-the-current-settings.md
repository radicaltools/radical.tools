---
id: "ad852a6f-b186-4e65-9844-612c71cb6244"
type: "scenario"
label: "Setup… shows the current settings"
given: "Studio set up before, light, with Ctrl as the special key"
tests: "apps/e2e/tests/studio/setup.spec.ts › Settings → Setup… opens it with the settings in use"
then: "the wizard opens at Theme with Light chosen, and its Special key step has Ctrl chosen"
when: "the user chooses Setup… under Settings"
---
