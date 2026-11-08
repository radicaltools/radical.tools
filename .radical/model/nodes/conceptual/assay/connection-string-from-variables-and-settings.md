---
id: "a0c8812a-3193-485b-ac83-0a42d4148639"
type: "scenario"
label: "Connection string from variables and settings"
given: "a VB6 unit building its MySQL connection string from variables, one set from its INI file's [MySQL] db key, and another unit whose database name is the placeholder YOUR DATABASE NAME beside a dump whose header names rfid_bot"
then: "the first unit uses the database its settings name, and the second the one the dump names"
when: "Assay reads them"
---
