---
id: "c1d54ae2-a214-4b06-bcb9-7432d39e3427"
type: "scenario"
label: "An Ant project, constants and SQL that is none"
given: "a NetBeans Ant project naming a main class and referencing ojdbc6.jar, whose SimpleJdbcCall names its function by a constant, with an annotation's description = and a caption Call failed (%1), and a VB6 module with Call in a comment and on the line after a Case string"
then: "the Ant project is a Java app, its one call is f_raise_salary, its database is Oracle's XE, and the VB6 module calls no routine"
when: "Assay reads them"
---
