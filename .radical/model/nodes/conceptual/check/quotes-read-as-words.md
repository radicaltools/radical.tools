---
id: "f255b52e-5d2a-4f88-b887-9b6c09a87a5f"
type: "scenario"
label: "Quotes read as words"
given: "a need with Tomek's answers in Markdown (bold, a list) and one on its question's line, and requirements quoting \"at most 10\" where the need says at most 100, quoting \"0\", quoting the bold answer without its marks, quoting two pieces from different answers joined by an ellipsis, and quoting words on a relation to another requirement"
then: "it reports errors for \"at most 10\", the one-word \"0\", the pieces from two answers and the quote on the relation to a requirement, nothing for the answer quoted without its Markdown, and a warning for the answer on its question's line that no requirement quotes"
when: "radical check checks the model"
---
