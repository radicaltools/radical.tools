---
id: "e25c7fc3-822e-484b-ab53-c17c17b512af"
type: "scenario"
label: "Limits, units and order kept"
given: "requirements quoting \"up to 90 percent\", \"at most 20 characters\", \"within 30 days\", \"oldest first\" and \"rounded half up\", which say they refuse 90 or more, accept at least 20 characters, 30 minutes, newest first and rounded down, and one quoting \"whole cents above zero\" that refuses a cost that is not above 0"
then: "it warns on each of the first five, naming what the requirement says and what the words say, and not on the refusal of what is not above 0"
when: "radical check checks the model"
---
