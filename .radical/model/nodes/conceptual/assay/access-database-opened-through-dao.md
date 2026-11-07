---
id: "046b61e9-972c-4554-ac02-475d0c79f447"
type: "scenario"
label: "Access database opened through DAO"
given: "a VB6 module whose constant names Projects.mdb and whose code opens App.Path & \"\\\\\" & that constant with DBEngine.OpenDatabase"
then: "the unit has an Access database fact named Projects.mdb, and the program is linked to it"
when: "Assay reads the repository"
---
