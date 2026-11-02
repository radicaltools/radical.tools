---
id: "a464d10e-ab1e-43a1-97c4-ac990648651f"
type: "scenario"
label: "Wizard switched off"
given: "Wizard on create is turned off, and Focus and Smart fit are off"
then: "it is created at once and no wizard opens; Focus and Smart fit stay off after the reload, and each change keeps the settings another writer changed since"
when: "an ADR is created; and Wizard on create is switched in Settings, the page reloaded, and another writer changes a setting meanwhile"
---
