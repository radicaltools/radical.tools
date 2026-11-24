---
id: "334e58d2-95bc-40af-9f8b-f4d44e126742"
type: "requirement"
label: "Pipeline defined as code"
action: "define its whole pipeline (builds, checks and deploys) in workflow files under .github/workflows in its own repository, changed only through pull requests, with steps that several workflows need kept in reusable workflows, and with every workflow passing actionlint"
ears_type: "ubiquitous"
rationale: "A pipeline that is code is reviewed, versioned and rebuilt like the element it builds; one configured by hand drifts where nobody sees it (Humble, Farley: Continuous Delivery, the deployment pipeline; GitHub Docs: Reusing workflows)."
---
