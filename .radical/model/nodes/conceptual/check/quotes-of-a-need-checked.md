---
id: "1f79b192-af20-4603-9de9-d0f7721bdb7c"
type: "scenario"
label: "Quotes of a need checked"
given: "a need Cost of goods whose text holds two answers of Tomek, \"A: No average (null, not zero), and its stock is worth 0.\" and \"A: Returns come back at the current average.\", a requirement deriving from it that quotes \"its stock is worth 0\", a second that quotes \"stock is worth nothing\", and a third with no quote"
then: "it reports an error for \"stock is worth nothing\" and a warning on Cost of goods for the answer about returns that no requirement quotes; an answer marked (no requirement) is not reported; the relation without a quote is no finding, counts against the goal requirements-quoting-need (2 of 3), and is a warning once check.json turns the rule on"
when: "radical check checks the model"
---
