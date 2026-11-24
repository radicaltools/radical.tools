---
id: "38242f71-4f98-4646-906a-ead71fbb49e5"
type: "need"
label: "The pipeline is a gate people trust"
kind: "brief"
source: "Hub concern pack: CI/CD pipeline"
---

Every change to this element reaches users through its pipeline, and the pipeline decides what a green check means. It has to be written down where changes are reviewed, run where nobody can skip it, deploy what was tested and nothing else, reach the cloud without keys that can leak, and answer quickly and reliably enough that people wait for it instead of working around it. The snippets assume a GitHub repository (our-org/shop) of a Node project: ci.yml runs on pull requests and ends in the gate job ci; deliver.yml runs on pushes to main, builds the image ghcr.io/our-org/shop/order-api in its job build and deploys it through the reusable workflow deploy.yml to the GitHub environments staging and production; the AWS roles ci-deploy-staging and ci-deploy-production are what the deploy jobs sign in as; and the checks of the pipeline itself are package.json scripts under scripts/.
