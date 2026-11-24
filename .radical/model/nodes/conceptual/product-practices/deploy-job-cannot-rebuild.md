---
id: "7a532f19-b3c5-4e4d-ae93-4611b36139e3"
type: "scenario"
label: "Deploy job cannot rebuild"
given: "a pull request that adds a docker build step to the production deploy job"
then: "it fails naming the job, and passes once the job deploys the digest the build job made"
when: "the promotion check runs"
---
