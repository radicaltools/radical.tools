---
id: "ea105c2f-cf5d-4707-96ae-64d1f6dfb3ca"
type: "requirement"
label: "Read units of any stack"
action: "the system shall find its units wherever they are in it, not only at its root: npm packages, Nx projects (project.json), Composer projects (PHP; an app when it is a Laravel application or has a front controller, claiming its folder before the package.json that builds its front end), Maven and Gradle projects, Go modules with their main packages, .NET projects (with the project references Directory.Build.props and Directory.Build.targets add by their conditions on the project's name and path) and SQL Server database projects (.sqlproj), a build project git tracks in a build folder (build/_build.csproj), Python projects, VB6 projects and groups (each reference read once, by its library's name, DirectX among its technologies, its description from its version information; a reference no code of the unit uses is marked unused and names no technology; several projects in one folder are one unit, known by each project's name and binary), and a folder with a Dockerfile no other unit claims, unless it is a development container (.devcontainer) or copies other units' projects or folders, which it builds; a compose service built from a context holding several units runs the one its Dockerfile builds or publishes; each an app or a library, with the stack it is written in, and with the units it depends on resolved by name or by path"
ears_type: "event-driven"
rationale: "Most systems are not npm, and most repositories hold several units below their root; measured on six public repositories of four stacks, the npm-only prototype found none."
trigger: "Assay reads a repository"
---
