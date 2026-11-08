---
id: "29ff84c4-64e7-4f1f-b92b-00496017ac01"
type: "scenario"
label: "A splash timer is no job"
given: "a VB6 form with a timer that only moves a progress bar and closes the splash, and one whose handler saves the world"
then: "only the second is a job"
when: "Assay reads it"
---
