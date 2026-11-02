---
id: "c3d26d03-7977-4425-931b-b6930964c9da"
type: "scenario"
label: "Hierarchy Size and Levels undone"
given: "a hierarchy view in Designer with an element's properties card open"
then: "Size, Levels and Up stay clear of the card; each change is one undo step that Undo takes back, and setting what is already set makes none"
when: "the user changes Size and Levels, sets one of them to what it already is, and presses Undo"
---
