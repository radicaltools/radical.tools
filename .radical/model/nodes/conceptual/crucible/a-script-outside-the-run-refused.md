---
id: "f620e186-7ac5-4f14-90c7-889afff46677"
type: "scenario"
label: "A script outside the run refused"
given: "a prepared round with run 5, a script named for it that is not in its folder, and earlier rounds that hold runs 3 to 5"
then: "verify exits 2 naming the script missing from the run's folder, runs nothing and records nothing in the journal; prepare exits 2 saying which round has the run and from which number to start, and makes no round"
when: "radical explore verify 5 runs that script, and radical explore prepare is asked for runs from a number an earlier round has"
---
