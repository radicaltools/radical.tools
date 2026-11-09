---
id: "e760f9dd-47e7-4845-80bf-e0d53ccad15b"
type: "scenario"
label: "Tooling, test folders, $(SolutionDir) and Django's urls"
given: "packages in .github/actions and .cursor, a Go plugin in plugin_api_tests, a .NET plugin referencing $(SolutionDir)\\Presentation\\Shop.Web\\Shop.Web.csproj and consuming an in-process IConsumer<OrderPlacedEvent>, and a Django urls.py with path, a multi-line re_path and an include"
then: "the tooling holds no units, the Go plugin is built for tests, the plugin references Shop.Web with no note, no message link is read, and the routes are /graphql and /orders/{pk}"
when: "Assay reads it"
---
