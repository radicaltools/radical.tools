---
id: "ae223863-1d1b-4cd4-85cb-67aa734d009a"
type: "scenario"
label: "Write tells of a lost value"
given: "a folder whose need holds the answer \"A: The stock is worth 0.\" and a requirement that says the stock value is null"
then: "the first answer names the value \"0\" the requirement does not say and the relation is written; the second does not name it"
when: "an agent links the requirement to the need with derives quoting \"The stock is worth 0\", then does the same in a folder whose check.json turns quote-value-missing off"
---
