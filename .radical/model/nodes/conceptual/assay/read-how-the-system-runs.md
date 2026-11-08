---
id: "1d76bc57-df23-4d1c-9f53-8407ec2ff575"
type: "requirement"
label: "Read how the system runs"
action: "the system shall read their services, each built from a unit or run from an image of a database, queue or cache, and the addresses their configuration gives one service of another, and the ports a compose service publishes on this machine as ports its unit listens on, as facts with their file and line"
ears_type: "event-driven"
rationale: "Deployment files state what runs and, in its environment, what calls what, in any language."
trigger: "a repository holds docker-compose files, Kubernetes manifests or a .NET Aspire AppHost"
---
