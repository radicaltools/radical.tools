---
id: "478754a3-1569-4483-8890-5bd586eba6e1"
type: "requirement"
label: "Superseded runs cancelled, deploys queued"
action: "cancel the running pipeline of a pull request when a newer commit is pushed to it, and run the deploys to one environment one at a time, never cancelling one that has started"
ears_type: "ubiquitous"
rationale: "Runs of a superseded commit only take runners from the current one, while a deploy cut off halfway leaves an environment in neither version (GitHub Docs: Control the concurrency of workflows and jobs)."
---
