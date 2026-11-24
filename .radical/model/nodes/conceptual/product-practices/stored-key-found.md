---
id: "8a9176ac-37e9-4ccf-8b62-b19c3ba57fef"
type: "scenario"
label: "Stored key found"
given: "a repository secret AWS_SECRET_ACCESS_KEY added for a quick fix"
then: "it fails naming the secret, and it fails too when a role's trust policy accepts every repository of the organisation"
when: "the nightly credentials check runs"
---
