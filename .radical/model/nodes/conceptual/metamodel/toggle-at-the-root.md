---
id: "91db8043-d868-4703-b173-283dbe63c5f7"
type: "scenario"
label: "Toggle At the root"
given: "the metamodel editor with the Software System type, which may sit at the top level"
metrics: "test(apps/e2e/tests/studio/metamodel-diagram.spec.ts › \"At the root\" shows and sets whether a type may sit at the top level) passed"
then: "the checkbox shows unchecked and the saved metamodel no longer allows a Software System at the root"
when: "the user opens its card and unchecks At the root"
---
