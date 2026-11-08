---
id: "7a7435d0-75f0-4828-9f8e-79a65b61cd38"
type: "scenario"
label: "References a build file adds"
given: "a .NET repository whose project files are empty and whose src/Directory.Build.targets adds each Application project its Domain project and the API project every module's Infrastructure project, by conditions on the project's name and path"
then: "each project depends on the projects the rules give it, as a ProjectReference in its own file would"
when: "Assay reads it"
---
