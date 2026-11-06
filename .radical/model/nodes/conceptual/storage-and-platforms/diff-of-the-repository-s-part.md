---
id: "4b87993c-c099-4722-b8d3-a1cac104d19a"
type: "requirement"
label: "Diff of the repository's part"
action: "it shall list only the changes of the repository's part, as the part is now and as it was at the base, so that an element taken out of the part is listed too"
ears_type: "event-driven"
rationale: "What a repository has left to build is what changed in its part since the commit of the model its code has reached; a loop that brings each repository to the model reads it, and so does its coding agent."
trigger: "radical diff runs with --part in a repository whose .radical/radical.json maps elements"
---
