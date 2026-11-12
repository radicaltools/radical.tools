---
id: "72c0c982-207b-4291-beb8-1efc46d9670f"
type: "scenario"
label: "Every part of an answer quoted"
given: "a need whose answer has a lead-in and three list items, with a requirement quoting the first item"
then: "first it warns that 2 of the 3 parts are not quoted, naming their starts; then nothing; then it names the whole answer"
when: "radical check checks the model, then with a second requirement quoting across the other two items, then with no quote at all"
---
