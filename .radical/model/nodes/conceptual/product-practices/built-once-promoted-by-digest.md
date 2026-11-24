---
id: "b319c535-717f-46d5-aeb9-08c30c475ebb"
type: "requirement"
label: "Built once, promoted by digest"
action: "build its image once, in the build job, and deploy that image by its sha256 digest to every environment, building nothing in a deploy job"
ears_type: "event-driven"
rationale: "Only build your binaries once: a rebuild for each environment may differ from what was tested, through a moved dependency, base image or tool (Humble, Farley: Continuous Delivery)."
trigger: "a commit is merged to main"
---
