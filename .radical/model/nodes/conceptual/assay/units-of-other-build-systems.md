---
id: "ec0403f0-5adb-4964-b787-8c6a1737f602"
type: "scenario"
label: "Units of other build systems"
given: "an Nx workspace with an e2e project.json beside the root package, a .sqlproj database project, a NUKE build/_build.csproj, a .devcontainer Dockerfile, a src/Dockerfile above the projects it builds, and a ratings/Dockerfile that packages the PHP application in ratings/html"
then: "the e2e project, the database project, the build project and ratings are units; neither the development container's folder nor src is"
when: "Assay reads the repository"
---
