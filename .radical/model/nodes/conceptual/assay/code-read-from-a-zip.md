---
id: "133c771b-bf33-4601-80f6-7c8ed1536488"
type: "scenario"
label: "Code read from a zip"
given: "a .zip file holding a Maven project and a .git folder whose configuration runs a command, and one with an entry named ../evil.txt"
then: "the first is unpacked into .radical/assay/unpacked/ without its .git folder, its project is a unit of the run and the command never runs; the second is refused naming the entry, and nothing of it is written"
when: "each is given to Assay"
---
