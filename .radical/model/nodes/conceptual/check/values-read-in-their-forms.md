---
id: "0947887b-9884-49ee-8f00-3e5a85aa5d52"
type: "scenario"
label: "Values read in their forms"
given: "requirements quoting \"20 percent off\", \"twenty-five at most\", \"only one warehouse\", \"15 minutes\" and \"after 30s\", which say 20%, 25, 1, 900 seconds and 60s"
then: "it reports only that the last does not say \"30\" and says \"60\""
when: "radical check checks the model"
---
