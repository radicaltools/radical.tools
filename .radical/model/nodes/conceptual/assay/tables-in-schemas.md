---
id: "d8bbff59-9445-4e97-aab6-050c0262443d"
type: "scenario"
label: "Tables in schemas"
given: "SQL that creates payments.Payers, payments.InboxMessages and meetings.InboxMessages, code inserting into [app].[Emails], and a JPQL query selecting from the entity PetType"
then: "the tables are Payers, payments.InboxMessages, meetings.InboxMessages and Emails; app and PetType are no tables"
when: "Assay reads them"
---
