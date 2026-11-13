---
id: "4a2b45f6-4ff2-45d4-b404-4cbe1020e331"
type: "scenario"
label: "Values of a quote checked"
given: "a need Cost of goods holding Tomek's answer \"No average (null, not zero), and its stock is worth 0.\" and a requirement quoting it whose sentence says the stock value is null without an average"
then: "first it warns that the requirement does not say \"0\"; then that it says \"409\", which no quote says; then nothing; a quote of the whole text of a need without answers checks no values"
when: "radical check checks the model, then again with the sentence saying 0 without an average and refusing a bad value with 409, then with a rationale naming 409 as the model's decision"
---
