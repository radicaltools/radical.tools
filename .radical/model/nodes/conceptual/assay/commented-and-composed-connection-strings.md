---
id: "4b12914f-8568-4be7-aa7a-e1d7b1e9f3d8"
type: "scenario"
label: "Commented and composed connection strings"
given: "a Symfony .env whose live DATABASE_URL is an SQLite file and whose commented lines give MySQL and PostgreSQL, a commented Redis address in YAML, and a compose file at the root whose backend service's DATABASE_URL takes its password from ${POSTGRES_PASSWORD:?Variable not set}"
then: "the Symfony unit uses the SQLite file only, and the backend uses database app on db, not the root folder"
when: "Assay reads them"
---
