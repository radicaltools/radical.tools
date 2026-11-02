---
id: "06d30521-78c7-42a2-8d45-4b7d8453a172"
type: "scenario"
label: "A stale code path warned about"
given: "elements whose descriptions name an existing file, a file that is gone and a URL"
then: "it warns only about the element naming the file that is gone"
when: "radical check runs in the repository"
---
