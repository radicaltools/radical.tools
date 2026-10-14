---
id: "3550943f-f0d2-4d09-9bdb-1dfbe9e0ec6d"
type: "requirement"
label: "Invalid catalogue stops build"
action: "The Hub catalogue plugin shall stop the Hub and Studio builds, and fail the dev server's catalogue request, with an error that names each file and its problem."
ears_type: "unwanted-behaviour"
rationale: "Keeps a broken concept off hub.radical.tools and out of Studio's import. Evidence: packages/hub-catalogue/src/catalogue.ts (validateCatalogue), packages/hub-catalogue/src/vite.ts, apps/hub/vite.config.ts, apps/studio/vite.web.config.ts, apps/studio/electron.vite.config.ts, packages/hub-catalogue/tests/catalogue.test.ts"
unwanted_condition: "a concept file lacks its hub block or its elements, sits at a path other than <category>/<id>.radical, repeats another concept's id, uses a {{KEY}} placeholder it does not declare, or names an unknown concept in hubRefs"
---
