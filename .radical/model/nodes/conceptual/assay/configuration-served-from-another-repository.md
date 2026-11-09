---
id: "4dd24d36-0eb2-45ea-8e4f-f02f1d1fc8c3"
type: "scenario"
label: "Configuration served from another repository"
given: "a config server whose application.yml sets spring.cloud.config.server.git.uri to a GitHub repository"
then: "a note names the file and line, the repository, and asks for it to be given to Assay too"
when: "Assay reads it"
---
