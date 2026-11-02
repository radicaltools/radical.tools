---
id: "d241f3b5-2ef2-4e8c-b65f-25f3045f9c71"
type: "scenario"
label: "A nightly function in the gate"
given: "a fitness function triggered on nightly with no measurement and one triggered on pull-request with none"
then: "only the pull-request one is reported not measured"
when: "radical check --trigger pull-request runs"
---
