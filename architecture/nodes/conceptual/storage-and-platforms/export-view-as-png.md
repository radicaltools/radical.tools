---
id: "b98866fb-ecad-4ec2-a434-9363820cb45a"
type: "scenario"
label: "Export view as PNG"
given: "the bookstore sample is open on the System context view"
metrics: "test(apps/e2e/tests/studio/export.spec.ts › export as PNG) passed"
then: "a .png file is downloaded whose header is a valid PNG larger than 200 by 200 pixels"
when: "the user chooses Export as PNG… under Export in the activity rail's Settings menu"
---
