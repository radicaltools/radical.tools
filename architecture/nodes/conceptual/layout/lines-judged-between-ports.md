---
id: "0a649c4c-402e-4397-8006-dbcc52110fdf"
type: "scenario"
label: "Lines judged between ports"
given: "a container with two databases on its right side"
tests: "packages/layout/tests/tidy/craft.test.ts › a line to a side shared by two lines ends at its port"
then: "the lines leave the container's right side one above the other, where Studio puts their ports; a database level with the container's middle is judged straight and the other, one of a fan, half a slant"
when: "Smart Layout tidies it"
---
