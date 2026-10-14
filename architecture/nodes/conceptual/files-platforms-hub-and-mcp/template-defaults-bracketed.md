---
id: "17c00a8e-997a-4898-a732-2ddbd9b84661"
type: "scenario"
label: "Template defaults bracketed"
given: "a Hub concept text with {{KEY}} placeholders and template parameters with a default, a hint only, or neither"
tests: |
  apps/hub/tests/hubViewer.test.ts › substituteTemplateDefaults
  apps/hub/tests/hubViewer.test.ts › conceptToDiagramData › substitutes template defaults but keeps them bracketed, and leaves unresolved keys visible
then: "a default or hint is shown still inside {{ }}, a placeholder with neither stays {{KEY}}, and an empty default is used as given"
when: "the Hub fills in the defaults"
---
