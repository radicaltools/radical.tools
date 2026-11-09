---
id: "c6ca816b-d9d4-43b5-8a01-5c56a978092b"
type: "scenario"
label: "Spring routes in their class, their context and their clients"
given: "a Spring service with server.servlet.context-path /accounts, a controller with @RequestMapping(\"/api\") whose methods map GET \"/{name}\" and, in a comment, \"/old\", and a Feign client interface mapping POST \"/uaa/users\""
then: "its routes are GET /accounts/api/{name} only: the comment names none and the Feign method is no route of the service"
when: "Assay reads it"
---
