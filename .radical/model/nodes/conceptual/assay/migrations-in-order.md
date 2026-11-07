---
id: "23613b8c-3ae6-4cf9-84dd-477aa2a346e6"
type: "scenario"
label: "Migrations in order"
given: "Laravel migrations that create books, pages and permissions, rename permissions to role_permissions and drop pages, and SQL migrations that create ArticleTags and drop it later"
then: "books and role_permissions are tables, with their columns and foreign keys, and pages, permissions and ArticleTags are not"
when: "Assay reads them"
---
