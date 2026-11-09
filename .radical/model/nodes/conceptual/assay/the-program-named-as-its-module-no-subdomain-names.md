---
id: "8d273868-d5d5-4197-ab47-b403c92fda32"
type: "scenario"
label: "The program named as its module, no subdomain names"
given: "a Go module example.com/chat/server/v8 whose chatctl reaches more packages than chat, a Node unit fetching https://api.github.com beside a unit named api, and a config under testdata"
then: "chat builds the shared packages, no link is read from api.github.com, and no database from testdata"
when: "Assay reads it"
---
