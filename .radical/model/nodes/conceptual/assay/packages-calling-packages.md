---
id: "f400da87-609d-4e18-b9c1-13850fae959a"
type: "scenario"
label: "Packages calling packages"
given: "a PL/SQL library whose s3_pkg.get_object calls http_util_pkg.get_blob, and an Assay run on it and a Java application that queries a table a package writes"
then: "s3_pkg is linked to http_util_pkg, the start counts the members in their packages' rows, both the application's container and the package's component realise the entity, and a scenario of the package's code goes to the library's unit"
when: "Assay reads and links it, and the plan makes the package a component of its database"
---
