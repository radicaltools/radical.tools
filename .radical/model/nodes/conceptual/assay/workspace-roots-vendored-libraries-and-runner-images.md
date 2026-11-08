---
id: "77fa7f6b-21fb-4409-a76b-eca95664e055"
type: "scenario"
label: "Workspace roots, vendored libraries and runner images"
given: "a uv workspace root with no [project], a .NET web app with Bootstrap vendored under wwwroot/lib, a compose service built from a Dockerfile of scripts that mounts ./web, and Go modules requiring a sibling through a replace directive"
then: "none of the root, the vendored library or the runner image is a unit, the compose service runs web, and each Go module depends on the sibling"
when: "Assay reads the repository"
---
