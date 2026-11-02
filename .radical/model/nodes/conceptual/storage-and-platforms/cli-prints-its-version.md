---
id: "1d85a26b-ba0d-489a-adf5-264d02038898"
type: "requirement"
label: "CLI prints its version"
action: "The CLI shall print the product version of its build, with its commit unless it was built from the release tag, and exit with 0."
ears_type: "event-driven"
rationale: "A CI log or a bug report names the radical check that ran."
trigger: "the user runs radical --version (or -v)"
---
