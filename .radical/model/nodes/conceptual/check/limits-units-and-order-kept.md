---
id: "e25c7fc3-822e-484b-ab53-c17c17b512af"
type: "scenario"
label: "Limits, units and order kept"
given: "requirements quoting \"up to 90 percent\", \"at most 20 characters\", \"within 30 days\", \"oldest first\" and \"rounded half up\", which say they refuse 90 or more, accept at least 20 characters, 30 minutes, newest first and rounded down, one quoting \"whole cents above zero\" that refuses a cost that is not above 0, and ones quoting \"cannot exceed 20\", \"can't\", \"doesn't\" or \"must not exceed 20\" that say at most 20; one quoting \"between 8 and 64\" that says at most 8; one quoting \"a guest who can't pay yet keeps at most 20\" that says at most 20; and ones quoting 10 years, 6 months and 5 € that say 10 days, 6 weeks and 5 USD"
then: "it warns on each of the first five, naming what the requirement says and what the words say, and not on the refusal of what is not above 0, nor on at most 20 for a negated limit of 20; it warns on the range read as at most 8 and on 10 days, 6 weeks and 5 USD, and not on at most 20 after a negation in a clause before the limit"
when: "radical check checks the model"
---
