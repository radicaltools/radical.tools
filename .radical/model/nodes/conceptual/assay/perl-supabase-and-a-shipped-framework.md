---
id: "3a439694-bb1f-4194-8507-5e4fb3d4ee4f"
type: "scenario"
label: "Perl, Supabase and a shipped framework"
given: "a Perl distribution on PostgreSQL calling a function in q{} SQL beside a test helper in t/lib, a Supabase project with its migrations and pgTAP tests, and an Oracle schema shipping utPLSQL below its root, reset first by its installer, which grants create trigger"
then: "the Perl application is a unit with its database and its one call, the helper's none; the Supabase project is a database unit with its table and test; and the Oracle schema keeps its package and table, its own test only, nothing of the shipped framework"
when: "Assay reads them"
---
