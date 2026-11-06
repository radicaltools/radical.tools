---
id: "ea105c2f-cf5d-4707-96ae-64d1f6dfb3ca"
type: "requirement"
label: "Read units of any stack"
action: "the system shall find its units wherever they are in it, not only at its root: npm packages, Maven and Gradle projects, Go modules with their main packages, .NET projects, Python projects, VB6 projects and groups, and a folder with a Dockerfile no other unit claims; each an app or a library, with the stack it is written in, and with the units it depends on resolved by name or by path"
ears_type: "event-driven"
rationale: "Most systems are not npm, and most repositories hold several units below their root; measured on six public repositories of four stacks, the npm-only prototype found none."
trigger: "Assay reads a repository"
---
