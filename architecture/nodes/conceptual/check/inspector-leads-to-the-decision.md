---
id: "7775653e-2327-42df-b192-aa9964e99a75"
type: "scenario"
label: "Inspector leads to the decision"
given: "a model folder in Studio where a person uses a web app and no ADR is marked with the authentication concern"
tests: "apps/e2e/tests/studio/inspector.spec.ts › the Inspector asks the questions of an unaddressed concern and the import settles it"
then: "the Inspector lists the concern with the web app and its questions; the import dialog opens on the Authentication pack bound to the web app; after the import the concern is gone from the Inspector"
when: "the user opens the Inspector, answers the authentication concern's questions from there (nobody signs in) and imports"
---
