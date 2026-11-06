---
id: "2e5f8b96-ae6d-4dc4-a970-2407f853d076"
type: "scenario"
label: "Documents taken as sources"
given: "a folder with a Markdown page, an HTML page and a PDF, and a public link serving an HTML page"
then: ".radical/assay/sources/ holds a text copy of each, the HTML pages as Markdown with their headings, and each is a document fact with its title, headings and origin"
when: "they are given to a run as sources"
---
