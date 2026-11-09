---
id: "18420077-cbda-4459-b73b-a25a6e2a923e"
type: "scenario"
label: "An Oracle schema's PL/SQL"
given: "a repository holding only an Oracle schema: tables, an ALTER TABLE ADD ( CONSTRAINT … FOREIGN KEY …), a global temporary table, a package spec and body with two members, a procedure calling a member, and a trigger on employees"
then: "db is a sql unit; the four tables, the foreign key, the package, its members, the procedure and the trigger are read with their lines, what each writes and reads, the procedure's call of emp_pkg.hire, the trigger's table, and Oracle as their dialect"
when: "Assay reads it"
---
