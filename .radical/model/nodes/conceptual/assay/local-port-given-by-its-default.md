---
id: "fd165ac1-d538-482f-b67b-4f02182ff3bf"
type: "scenario"
label: "Local port given by its default"
given: "a web front end calling http://localhost:${process.env.VUE_APP_USERS_HTTP_PORT || 3002}/api, and a compose service running the users unit that publishes 127.0.0.1:3002:8080"
then: "the front end calls the users unit, by the port its service publishes"
when: "Assay reads and links the repository"
---
