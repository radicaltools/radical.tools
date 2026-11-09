---
id: "069bfc62-f673-446a-9e30-3aa8c37b6c52"
type: "scenario"
label: "Deployment under build/ and Prometheus targets"
given: "a repository with build/docker/docker-compose.yml building the api-gateway unit, compiled classes under build/, and a Prometheus folder whose prometheus.yml scrapes api-gateway:8080"
then: "the compose file is read, the compiled classes are not, and the Prometheus unit calls api-gateway"
when: "Assay reads it"
---
