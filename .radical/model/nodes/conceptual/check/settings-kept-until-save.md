---
id: "f173dbd5-96f5-432a-84c6-999bdcdc3c2f"
type: "scenario"
label: "Settings kept until Save"
given: "a folder model open in the Inspector's Settings"
then: "the change is still there each time and the Settings tab says it is unsaved; check.json holds it only after Save"
when: "the user changes a severity, opens another tab and comes back, goes Back and forward, then saves"
---
