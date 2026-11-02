---
id: "12fd43b1-4980-42bc-84c2-723cfdf8cdf0"
type: "scenario"
label: "Reviews kept beside the repository"
given: "a repository whose model folder holds a reviews.json"
then: "the review goes into .radical/reviews.json, check reads both until setup moves the model folder's into .radical/"
when: "radical sense review records a review, radical check reads them, and radical setup runs"
---
