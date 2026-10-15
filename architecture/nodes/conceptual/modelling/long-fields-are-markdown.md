---
id: "7086721e-91a9-422d-b4c1-08c64d515958"
type: "requirement"
label: "Long fields are Markdown"
action: "Studio shall read an element's description and every textarea property as Markdown: the wiki renders them (paragraphs, line breaks as written, lists, emphasis, code, quotes, tables, links opening outside the app, raw HTML shown as text) and edits them as written on a click; the table's summary renders inline Markdown, its template's own text included, a plain value escaped into it and its tooltip plain text; a card on the canvas shows the text without its marks; and a textarea in the properties panel says it takes Markdown."
ears_type: "ubiquitous"
rationale: "Descriptions and ADR fields are prose, and the description already is the Markdown body of an element's file in a folder model; bold, lists and links make them readable where they are read. Evidence: packages/common/src/markdown.ts (isMarkdownField, markdownToPlain, escapeMarkdown, keepLineBreaks), packages/common/src/nodeSummary.ts, packages/ui/src/components/MarkdownText.tsx (markdown-to-jsx), packages/ui/src/components/WikiView.tsx (InlineText, partSummary), packages/ui/src/components/TableView.tsx (renderSummary), packages/ui/src/store/diagramStore.ts (plainDescription), packages/ui/src/components/RightPanel.tsx (MARKDOWN_HINT), apps/studio/src/renderer/src/components/MetamodelEditor.tsx (SummaryField)"
---
