---
id: "f2c79ed0-48ee-4fc3-a718-aefacd26b8c4"
type: "scenario"
label: "Status flags read"
given: "an SQL schema whose user table has is_dead and is_ban, and an invoice table with a nullable PaidOn, and code that sets is_dead = 1 and PaidOn"
then: "there is a flags fact for each table, with the values dead, not dead, ban, not ban and paid, not paid, and the lines that set them"
when: "Assay reads it"
---
