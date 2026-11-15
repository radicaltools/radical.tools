---
id: "e1ac0fe9-b4a7-4d74-9de8-9c3b06524a61"
type: "scenario"
label: "Other models added to an open model"
given: "a model folder without deps.json open in Studio"
then: "Studio shows the other models without a reload, and again once deps.json is back"
when: "deps.json is added and the other models are fetched; then deps.json is removed and added back"
---
