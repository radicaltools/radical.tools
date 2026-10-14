---
id: "517e3eaf-3439-41f5-a071-d33729b2c140"
type: "scenario"
label: "Rewrite sentence, group parts"
given: "a requirement written in the wiki as \"When a payment fails, the system shall tell the customer why\""
tests: "apps/e2e/tests/studio/wiki.spec.ts › writing in the wiki › a sentence is rewritten whole, and a group at the top is not offered parts of a system"
then: "the sentence is read again and the requirement becomes complex; the new group's page offers Requirements and Software systems but no Containers or Components"
when: "the user rewrites its sentence with a While and an If clause, then adds a Group at the top of the model"
---
