---
id: "d1dd9fd3-80c4-4b53-8d99-f3463b2d5b8a"
type: "scenario"
label: "Broken workflow refused"
given: "a pull request that adds a job whose needs names a job that does not exist"
then: "actionlint fails naming the file and line, and the gate job ci fails with it"
when: "the pull-request checks run"
---
