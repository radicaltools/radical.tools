---
id: "4461312e-9243-4a09-afd8-6dbf3fa083d4"
type: "scenario"
label: "Lines of a run's file read"
given: "an Assay run over a repository"
then: "the first answer holds the five lines, numbered; the listings name the files to read, .git aside; the last is refused"
when: "the agent reads lines 1 to 5 of one of its files, lists its root and one of its folders, and then reads ../outside.txt"
---
