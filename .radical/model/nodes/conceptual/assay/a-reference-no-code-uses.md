---
id: "0e7e474e-ec46-49ac-baff-d4401085fc83"
type: "scenario"
label: "A reference no code uses"
given: "a VB6 project referencing the Excel and Word object libraries, whose code creates an Excel application"
then: "the Word reference is marked unused, and Excel is among the unit's dependencies used"
when: "Assay reads it"
---
