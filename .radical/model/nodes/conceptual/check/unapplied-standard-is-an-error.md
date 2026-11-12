---
id: "b2feb337-2d58-46da-af18-8e7281d8d52b"
type: "scenario"
label: "Unapplied standard is an error"
given: "shop's model depending on standards, whose accepted ADR Append-only records constrains none of shop's elements and which no ADR of shop waives"
then: "it reports an inherited-adr-unapplied error naming Append-only records and standards@<commit>, with how to apply or waive it, and the check fails; nothing it finds about the ADR itself is left in"
when: "radical check checks shop's model"
---
