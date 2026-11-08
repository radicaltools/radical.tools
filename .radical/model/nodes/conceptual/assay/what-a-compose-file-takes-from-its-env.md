---
id: "d69e583d-9557-4462-b351-9dab7a4bec06"
type: "scenario"
label: "What a compose file takes from its .env"
given: "a compose file whose services build Dockerfiles .env variables name and pass an address by the variable's name only, a Kafka image adding an agent fetched from the web, an OpAMP server, and a root package.json of markdownlint alone"
then: "each service runs the unit its Dockerfile is in, the Kafka folder is a unit, the OpAMP server is observability, there is no root unit, and checkout calls cart at the address .env gives"
when: "Assay reads it"
---
