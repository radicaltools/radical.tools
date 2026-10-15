---
id: "dfda3cd9-3c74-4a57-8a03-69cb70217aa9"
type: "requirement"
label: "Multi page chapters"
action: "write the element's children as chapters listed in a table of contents, as many levels deep as the Depth in the wiki view's properties says (1 to 5, 1 by default) and deeper children as preview cards, title a group's chapter by the group's own name rather than under a Groups heading, name the elements of a chapter under their type with what that type is, and offer to open each chapter's own page"
ears_type: "event-driven"
rationale: "A system reads as one article with its parts as chapters, the way a reader expects a document to read; how deep it goes belongs to the view, saved with it, like its Single or Multi page. Evidence: packages/ui/src/components/WikiView.tsx, packages/ui/src/components/RightPanel.tsx (ViewPropertiesContent), packages/common/src/c4.ts (wikiDepthOf), apps/e2e/tests/studio/wiki.spec.ts"
trigger: "the user switches an element's wiki page to Multi page"
---
