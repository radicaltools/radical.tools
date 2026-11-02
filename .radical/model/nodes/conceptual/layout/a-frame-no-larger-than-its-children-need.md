---
id: "128b007c-cb10-46bd-a41a-4753612d96e1"
type: "scenario"
label: "A frame no larger than its children need"
given: "a system holding one container"
metrics: "test(packages/layout/tests/tidy/craft.test.ts › a frame is no larger than its children and padding need) passed"
then: "the system is as wide and as tall as the container with its padding, not its empty default size"
when: "Smart Layout tidies it"
---
