---
id: "f07170af-4d2b-43b3-830b-5345e609f850"
type: "scenario"
label: "Migrator waited for, not called"
given: "a compose file whose API service depends on a migrator service and waits for a seeder with condition: service_completed_successfully, and depends on its database"
then: "the API depends on its database at run time, and on neither the migrator nor the seeder"
when: "Assay reads and links the repository"
---
