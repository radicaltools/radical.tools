---
id: "3dba5835-124e-41cf-9024-b5829c1112f8"
type: "requirement"
label: "Preview a pack's answers"
action: "The Hub shall redraw the pack's canvas, wiki and table with only the elements the picked answers bring in, their texts filled with those answers, light up for a few seconds the elements the answer added, and show how many of the pack's elements are in; the panel lists every question with its options, the defaults picked when the pack opens, how many elements each other option would add or remove, and offers Defaults and All (every variant at once, as before)."
ears_type: "event-driven"
rationale: "A reader judges a pack by what it would put into the model for them, not by every variant at once; the questions are the pack's decisions. Same variant selection as Studio's concern wizard (pickVariant, answerTexts in @radical/common/concerns)."
trigger: "the reader picks an answer in the Answers panel of an open concern pack"
---
