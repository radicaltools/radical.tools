---
id: "376d790c-e0a8-4df0-8b29-cf44258d41a7"
type: "scenario"
label: "Units of every stack read"
given: "a repository with a Maven module, a Go service, a .NET web project referencing a library project, a Python service, a VB6 group whose test project references its library project, and a folder with only a Dockerfile"
then: "each is a unit with its stack and kind, and each reference between them is a dependency on the unit it names"
when: "Assay reads it"
---
