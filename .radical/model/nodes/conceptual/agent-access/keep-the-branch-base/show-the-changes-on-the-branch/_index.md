---
id: "4982156e-b54d-49d7-9b0e-0a68346bc9cb"
type: "step"
label: "Show the changes on the branch"
children: "sequence"
condition: "while the model is edited"
order: 3
repeat: "1..n"
---

Studio polls the base, compares the model with it as it is edited, and shows the count on Changes on branch, the marks and ghosts on the canvas, the changed fields on the card and the Inspector's Changes tab.
