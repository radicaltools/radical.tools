---
id: "92395d99-9585-4956-b222-a8fbba371ccf"
type: "scenario"
label: "Stored routines listed by package"
given: "a repository of one Oracle package with two members, one writing a table and one calling the other without parentheses"
then: "one row stands for the package, its members folded into it with their ids, kinds, lines and what each writes and calls, and the answer names pdf.add_page as the routine using the entity's table"
when: "assay_facts lists the stored routines, and a plan makes an entity of the table"
---
