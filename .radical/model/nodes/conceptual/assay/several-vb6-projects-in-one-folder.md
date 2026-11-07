---
id: "87079c41-cc85-4793-8bd3-d15f6caef966"
type: "scenario"
label: "Several VB6 projects in one folder"
given: "a folder holding the projects of two VB6 libraries, and a program elsewhere that references the second library's binary"
then: "the folder is one unit known by both binaries, and the program is linked to it"
when: "Assay reads the repository"
---
