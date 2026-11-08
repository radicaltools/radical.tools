---
id: "22e3ad6a-de06-48fb-b0db-c6d1f7e833d4"
type: "scenario"
label: "Client made in a library"
given: "Go modules where internal/common's NewTrainerClient makes a TrainerService client, and trainings imports internal/common/client and calls NewTrainerClient, while users only imports the library"
then: "trainings calls trainer over gRPC, and users does not"
when: "Assay reads and links the repository"
---
