---
id: "f626cd4f-0c1a-492b-8359-3683a0590eb3"
type: "scenario"
label: "Laravel's default connection"
given: "a Laravel application whose .env.example sets DB_DATABASE=wiki and no DB_CONNECTION, and whose config/database.php makes mysql the default connection"
then: "the application uses the MySQL database wiki"
when: "Assay reads it"
---
