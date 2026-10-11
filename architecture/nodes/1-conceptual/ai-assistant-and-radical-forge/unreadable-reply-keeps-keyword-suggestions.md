---
id: "4b99f816-5309-4f6c-bd4d-5d30cef8c50b"
type: "scenario"
label: "Unreadable reply keeps keyword suggestions"
gherkin: "# Covered by: apps/studio/tests/forgeClarify.test.ts › returns the Hub candidates the model picked, or null when its reply is unreadable; packages/common/tests/forgeClarify.test.ts › Hub picks"
given: "a Forge stage with Hub candidates"
then: "no pick is recorded and the stage card keeps the keyword suggestions"
when: "the model answers the clarify call with prose instead of the JSON array"
---
