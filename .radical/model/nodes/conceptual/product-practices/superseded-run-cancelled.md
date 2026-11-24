---
id: "79d30757-ac00-49ea-80fd-9d21098fbc53"
type: "scenario"
label: "Superseded run cancelled"
given: "a pull request whose pipeline is running, and a deploy to staging in progress"
then: "the old pull-request run is cancelled, and the second deploy waits until the first has finished"
when: "a new commit is pushed to the pull request and a second merge starts another deploy to staging"
---
