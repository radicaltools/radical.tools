---
id: "cb6a98d3-c5bf-4dab-a8c3-ef9072d77086"
type: "component"
label: "Wiki and table views"
technology: "React (@radical/ui)"
---

packages/ui/src/components/WikiView.tsx and TableView.tsx. The wiki renders the shared @radical/common/wikiDocument projection: view scope and hierarchy, one page per element, lead/facts/sections, requirement sentences and relationship groups. React supplies editing, navigation and rendering; the CLI export uses the same pure content builder. The table shows the view's chain or containment as a tree of names, whose rows open properties or a wizard and add elements along the chain (packages/common/src/viewPipeline.ts).
