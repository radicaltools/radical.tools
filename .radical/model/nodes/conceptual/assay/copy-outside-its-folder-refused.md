---
id: "f3ee03cf-eff7-492b-99a8-d4b2c7bf56f7"
type: "scenario"
label: "Copy outside its folder refused"
given: "a link redirected to a path whose last part decodes to ../../x.json, a .zip file named ...zip, and a folder named ..notes"
then: "nothing is written outside each one's own folder in .radical/assay/, and no other folder is emptied"
when: "they are given to a run"
---
