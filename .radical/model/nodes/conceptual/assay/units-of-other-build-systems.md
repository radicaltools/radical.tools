---
id: "ec0403f0-5adb-4964-b787-8c6a1737f602"
type: "scenario"
label: "Units of other build systems"
given: "an Nx workspace with an e2e project.json beside the root package, a .sqlproj database project, a NUKE build/_build.csproj, a .devcontainer Dockerfile and a src/Dockerfile above the projects it builds"
then: "the e2e project, the database project and the build project are units; neither Dockerfile folder is"
when: "Assay reads the repository"
---
