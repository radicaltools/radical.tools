---
id: "0e76618e-7acf-46d3-bbc8-f9fdbfbdf7ea"
type: "scenario"
label: "A Go module of several mains"
given: "a Go module with cmd/chat importing its api package and cmd/chatctl importing nothing, the api package hanging users off an /api/v1 subrouter with Handle and Methods, a route in a comment, and up and down SQL migrations"
then: "cmd/chat builds the shared packages and holds their routes, POST /api/v1/users and GET /api/v1/users/{id}, and tables users and posts, no down migration dropping them"
when: "Assay reads it"
---
