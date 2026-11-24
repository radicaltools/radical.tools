---
id: "43732a01-c185-4bf4-8484-ee82f74955c1"
type: "scenario"
label: "Skipped job does not pass"
given: "a pull request whose test job fails, so that the job after it is skipped"
then: "the gate job ci fails and the pull request cannot be merged, although the skipped job shows as passed"
when: "the pipeline finishes"
---
