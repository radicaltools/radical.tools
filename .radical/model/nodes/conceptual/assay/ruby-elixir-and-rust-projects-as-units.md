---
id: "6668ec63-d414-4bc7-8f0f-41620d1f8862"
type: "scenario"
label: "Ruby, Elixir and Rust projects as units"
given: "a Rails application with a package.json of Biome alone, an Elixir umbrella whose web app depends on its core app, and a Cargo workspace whose api crate depends on its domain crate by path, beside a Go module of tools.go alone"
then: "the Rails application is one Ruby app known by its module, the umbrella's root and the workspace's root are no units, the web app and the api crate depend on the core app and the domain crate, and the tools module is no unit"
when: "Assay reads them"
---
